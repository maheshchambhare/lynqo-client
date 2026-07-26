import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Send, Lock, Sparkles, MessageSquare, ExternalLink, ShieldCheck, Users, Video, CheckCircle2, Volume2, VolumeX, Maximize, PictureInPicture2, Download } from 'lucide-react';
import { VideoComment } from './types';

function getTokenFromUrl(): string {
  const path = window.location.pathname;
  if (path.startsWith('/public/v/')) return path.replace('/public/v/', '').split('/')[0];
  if (path.startsWith('/v/')) return path.replace('/v/', '').split('/')[0];
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('v/')) return hash.replace('v/', '').split('/')[0];
  if (hash.startsWith('token=')) return hash.replace('token=', '').split('&')[0];
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('token')) return searchParams.get('token')!;
  return 'demo';
}

export default function App() {
  const [token] = useState<string>(getTokenFromUrl);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Strict Auth State — Requires password on every page open if protected
  const [requiresAuth, setRequiresAuth] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuthStatus, setIsCheckingAuthStatus] = useState<boolean>(true);
  
  const [authorName, setAuthorName] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginNameInput, setLoginNameInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingAuthor, setTypingAuthor] = useState('');
  const [p2pConnected, setP2pConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pro Branding Customization
  const [isPro, setIsPro] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [customLink, setCustomLink] = useState<string | null>(null);
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [customBrandTitle, setCustomBrandTitle] = useState<string | null>(null);
  const [customFaviconUrl, setCustomFaviconUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  
  // Tabs & Responsiveness
  const [activeTab, setActiveTab] = useState<'messages' | 'participants'>('messages');
  const [mobileViewTab, setMobileViewTab] = useState<'player' | 'notes' | 'participants'>('player');
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  const getServerBaseUrl = (): string => {
    if (import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL.replace(/\/+$/, '');
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('server')) {
      const s = params.get('server')!.replace(/\/+$/, '');
      try { localStorage.setItem('lynqo_server_url', s); } catch (_) {}
      return s;
    }
    const hash = window.location.hash;
    if (hash.includes('server=')) {
      const match = hash.match(/server=([^&]+)/);
      if (match) {
        const s = decodeURIComponent(match[1]).replace(/\/+$/, '');
        try { localStorage.setItem('lynqo_server_url', s); } catch (_) {}
        return s;
      }
    }
    if (import.meta.env.DEV) {
      return 'http://127.0.0.1:7432';
    }
    try {
      const saved = localStorage.getItem('lynqo_server_url');
      if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    } catch (_) {}
    if (window.location.origin.includes('pages.dev') || window.location.origin.includes('github.io') || window.location.origin.includes('lynqo.mcrudra.com')) {
      return 'http://127.0.0.1:7432';
    }
    return window.location.origin;
  };

  const serverBaseUrl = getServerBaseUrl();
  const streamUrl = `${serverBaseUrl}/public/v/${token}/stream?pwd=${encodeURIComponent(passwordInput)}&client_name=${encodeURIComponent(authorName)}`;

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dynamic Browser Tab Title & Favicon Effect
  useEffect(() => {
    const brandName = (isPro && customBrandTitle && customBrandTitle.trim()) ? customBrandTitle.trim() : 'Lynqo Studio';
    document.title = brandName;

    const defaultFavicon = `${serverBaseUrl}/public/appicon.png`;
    const favUrl = (isPro && (customFaviconUrl || customLogo)) ? (customFaviconUrl || customLogo)! : defaultFavicon;
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.type = 'image/png';
    link.href = favUrl.startsWith('/') ? `${serverBaseUrl}${favUrl}` : favUrl;
  }, [isPro, customBrandTitle, customFaviconUrl, customLogo, serverBaseUrl]);

  const isMobile = screenWidth < 768;
  const isTablet = screenWidth >= 768 && screenWidth <= 1024;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  // Check auth status on load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsCheckingAuthStatus(true);
      try {
        const res = await fetch(`${serverBaseUrl}/public/v/${token}/auth_status`);
        if (res.ok) {
          const data = await res.json();
          setRequiresAuth(data.requires_auth);
          setIsPro(data.is_pro || false);
          setCustomLogo(data.custom_logo || null);
          setCustomLink(data.custom_link || null);
          setRemoveWatermark(data.remove_watermark || false);
          setCustomBrandTitle(data.custom_brand_title || null);
          setCustomFaviconUrl(data.custom_favicon_url || null);
          
          if (!data.requires_auth) {
            setIsAuthenticated(true);
            setAuthorName('Client Reviewer');
            fetchComments('', 'Client Reviewer');
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setAuthError(`Unable to connect to Lynqo server at ${serverBaseUrl}. Please ensure your Lynqo Desktop app is running and your share link includes ?server= parameter.`);
        }
      } catch (e) {
        console.error('Failed to check auth status:', e);
        setAuthError(`Unable to connect to Lynqo Desktop server (${serverBaseUrl}). Make sure Lynqo Desktop app is active.`);
      } finally {
        setIsCheckingAuthStatus(false);
      }
    };
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);


  // Custom Video Player State
  const [isBuffering, setIsBuffering] = useState(false);
  const [showOverlayControls, setShowOverlayControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcPeerRef = useRef<RTCPeerConnection | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const lastCommentsJsonRef = useRef<string>('');
  // Fetch comments
  const fetchComments = async (pwd?: string, name?: string) => {
    const currentPwd = pwd !== undefined ? pwd : passwordInput;
    const currentName = name !== undefined ? name : authorName;
    try {
      const url = `${serverBaseUrl}/public/v/${token}/comments?pwd=${encodeURIComponent(currentPwd)}&client_name=${encodeURIComponent(currentName)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const jsonStr = JSON.stringify(data);
        if (jsonStr !== lastCommentsJsonRef.current) {
          lastCommentsJsonRef.current = jsonStr;
          setComments(data);
          setTimeout(scrollToBottom, 100);
        }
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    }
  };

  const handleAuthenticate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) {
      setAuthError('Please enter the project password.');
      return;
    }
    setIsSubmittingAuth(true);
    setAuthError(null);

    const clientName = loginNameInput.trim() || 'Client Reviewer';

    try {
      const res = await fetch(`${serverBaseUrl}/public/v/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: clientName, password: passwordInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        const resolvedName = data.client_name || clientName;
        setAuthorName(resolvedName);
        fetchComments(passwordInput.trim(), resolvedName);
        showToast('🔓 Authenticated successfully!');
      } else {
        setAuthError(data.error || 'Invalid credentials. Please check password.');
      }
    } catch (e) {
      setAuthError(`Authentication failed. Could not reach Lynqo server at ${serverBaseUrl}.`);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Connect WebSocket & WebRTC P2P
  useEffect(() => {
    if (!isAuthenticated) return;

    const wsUrl = serverBaseUrl.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        const peer = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        rtcPeerRef.current = peer;

        peer.onicecandidate = (e) => {
          if (e.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ice_candidate', token, candidate: e.candidate }));
          }
        };

        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'connected') {
            setP2pConnected(true);
          }
        };

        const dc = peer.createDataChannel('lynqo-review');
        dc.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === 'video_typing') {
              handleTypingNotice(msg);
            }
          } catch (_) {}
        };
      } catch (e) {
        console.warn('WebRTC fallback:', e);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const eventToken = msg.token || msg.share_token;
        if (!eventToken || eventToken === token) {
          if (msg.type === 'video_typing') {
            handleTypingNotice(msg);
          } else if (msg.type === 'video_comment_added') {
            fetchComments();
            showToast('💬 New feedback note added!');
          } else if (msg.type === 'webrtc_offer' && rtcPeerRef.current) {
            rtcPeerRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp)).then(() => {
              return rtcPeerRef.current!.createAnswer();
            }).then((answer) => {
              return rtcPeerRef.current!.setLocalDescription(answer);
            }).then(() => {
              ws.send(JSON.stringify({ type: 'webrtc_answer', token, sdp: rtcPeerRef.current!.localDescription }));
            });
          } else if (msg.type === 'ice_candidate' && rtcPeerRef.current) {
            rtcPeerRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
          }
        }
      } catch (_) {}
    };

    const pollInterval = setInterval(() => {
      fetchComments();
    }, 3000);

    return () => {
      ws.close();
      rtcPeerRef.current?.close();
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  const handleTypingNotice = (data: { is_typing?: boolean; author?: string; author_name?: string }) => {
    const author = data.author || data.author_name || 'Reviewer';
    if (data.is_typing && !author.toLowerCase().includes('client')) {
      setIsTyping(true);
      setTypingAuthor(author);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsTyping(false), 4000);
    } else {
      setIsTyping(false);
    }
  };

  const handleInputChange = (text: string) => {
    setCommentText(text);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'video_typing',
          token,
          share_token: token,
          is_typing: text.length > 0,
          author: authorName.trim() || 'Client',
          author_name: authorName.trim() || 'Client',
        })
      );
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    const time = videoRef.current?.currentTime || 0;
    const currentName = authorName.trim() || 'Client Reviewer';
    try {
      const url = `${serverBaseUrl}/public/v/${token}/comments?pwd=${encodeURIComponent(passwordInput)}&client_name=${encodeURIComponent(currentName)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp_sec: time,
          author_name: currentName,
          comment_text: commentText.trim(),
        }),
      });

      if (res.ok) {
        setCommentText('');
        fetchComments();
        showToast('🚀 Note submitted live!');
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'video_typing',
              token,
              share_token: token,
              is_typing: false,
              author: currentName,
              author_name: currentName,
            })
          );
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        setAuthError('Session expired or authentication invalid. Please re-enter password.');
      }
    } catch (e) {
      console.error('Failed to post comment:', e);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const formatTimeShort = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleShowControls = () => {
    setShowOverlayControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowOverlayControls(false);
      }, 2500);
    }
  };

  const handleHideControls = () => {
    if (isPlaying) {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = setTimeout(() => {
        setShowOverlayControls(false);
      }, 600);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => setIsPlaying(true));
          }
        });
        handleShowControls();
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowOverlayControls(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !videoRef.current.muted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const togglePiP = () => {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(console.error);
    } else if (videoRef.current && document.pictureInPictureEnabled) {
      videoRef.current.requestPictureInPicture().catch(console.error);
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('viewfinderContainer');
    if (!document.fullscreenElement) {
      if (container && container.requestFullscreen) {
        container.requestFullscreen();
      } else if (videoRef.current && videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const stepFrame = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
  };

  if (isCheckingAuthStatus) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050609', color: '#00f0ff', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles size={36} className="animate-spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Checking Project Credentials...</div>
        </div>
      </div>
    );
  }

  // High Security Login Gateway Modal if Unauthenticated and requiresAuth
  if (requiresAuth && !isAuthenticated) {
    return (
      <div className="login-gateway-container">
        <form onSubmit={handleAuthenticate} className="card">
          <div className="brand-logo-container" style={{ height: 60, margin: '0 auto 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isPro && customLogo && !logoError ? (
              <img
                src={customLogo.startsWith('/') ? `${serverBaseUrl}${customLogo}` : customLogo}
                alt="Logo"
                onError={() => setLogoError(true)}
                style={{ maxHeight: 44, maxWidth: 220, objectFit: 'contain' }}
              />
            ) : !logoError ? (
              <img
                src={`${serverBaseUrl}/public/horizontal-logo.png`}
                alt="Lynqo Studio"
                onError={() => setLogoError(true)}
                style={{ maxHeight: 44, maxWidth: 220, objectFit: 'contain' }}
              />
            ) : (
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                🎬 {customBrandTitle || "Lynqo Review Studio"}
              </div>
            )}
          </div>
          <h2>{customBrandTitle || "Lynqo Review Studio"}</h2>
          <div className="filename-tag">{token}</div>
          <p className="subtitle">
            This video review session is password protected. Enter password to gain access.
          </p>

          {authError && (
            <div className="error-banner">
              ⚠️ {authError}
            </div>
          )}

          <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#a0aec0', fontWeight: 700, marginBottom: 6, display: 'block' }}>Your Client Name <span style={{ opacity: 0.6, fontWeight: 500 }}>(Optional)</span></label>
            <input
              type="text"
              placeholder="e.g. John Doe (leave empty for Client)"
              value={loginNameInput}
              onChange={(e) => setLoginNameInput(e.target.value)}
              style={{ width: '100%', padding: '0.95rem 1.25rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '1.75rem' }}>
            <label style={{ fontSize: '0.78rem', color: '#a0aec0', fontWeight: 700, marginBottom: 6, display: 'block' }}>Project Password *</label>
            <input
              type="password"
              placeholder="Enter project password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
              style={{ width: '100%', padding: '0.95rem 1.25rem', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#fff', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingAuth}
            className="btn-unlock"
          >
            {isSubmittingAuth ? 'Verifying Credentials...' : 'Unlock Project Review 🚀'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="studio-app-container">
      {/* Background decorative hand-drawn doodles */}
      <div className="doodle-container">
        {/* Doodle Sparkle 1 */}
        <svg className="doodle doodle-sparkle-1" viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>
        </svg>
        {/* Doodle Sparkle 2 */}
        <svg className="doodle doodle-sparkle-2" viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v2M12 16v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4"/>
        </svg>
        {/* Doodle Star */}
        <svg className="doodle doodle-star" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        {/* Doodle Loop Arrow */}
        <svg className="doodle doodle-loop" viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12A9 9 0 0 0 4.3 8.3L3 9.5v-5M3 12a9 9 0 0 0 16.7 3.7l1.3-1.2V19"/>
        </svg>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast show">
          <Sparkles size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Navbar */}
      <header className="glass-header">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isPro && (customLogo || customBrandTitle) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {customLogo && (
                <img src={customLogo.startsWith('/') ? `${serverBaseUrl}${customLogo}` : customLogo} alt="Brand Logo" style={{ height: 32, maxWidth: 140, objectFit: 'contain', borderRadius: 8 }} />
              )}
              {customBrandTitle && customBrandTitle.trim() && (
                <span className="brand-name-header-text" style={{ color: '#0f172a', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                  {customBrandTitle.trim()}
                </span>
              )}
            </div>
          ) : (
            <img src={`${serverBaseUrl}/public/horizontal-logo.png`} alt="Lynqo Studio" style={{ height: 24, objectFit: 'contain' }} />
          )}
          {!isMobile && (
            <span className={p2pConnected ? "badge-live" : "badge-client"} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p2pConnected ? '#059669' : '#9333ea' }} />
              {p2pConnected ? 'WebRTC Direct P2P' : 'Realtime Sync Active'}
            </span>
          )}
        </div>

        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href={`${serverBaseUrl}/public/v/${token}/download?pwd=${encodeURIComponent(passwordInput)}&client_name=${encodeURIComponent(authorName)}`}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            <span>Download</span>
          </a>
          {(() => {
            const hasCustomLink = isPro && customLink && customLink.trim() !== '';
            if (hasCustomLink) {
              const label = customBrandTitle && customBrandTitle.trim() !== '' 
                ? customBrandTitle.trim() 
                : customLink!.replace(/^https?:\/\//, '').replace(/\/$/, '');
              return (
                <a href={customLink!} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  <Sparkles size={14} />
                  <span>{label}</span>
                  <ExternalLink size={12} />
                </a>
              );
            }
            if (!isPro || !removeWatermark) {
              return (
                <a href="https://mcrudra.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
                  <ShieldCheck size={14} />
                  <span>MCRudra.com</span>
                  <ExternalLink size={12} />
                </a>
              );
            }
            return null;
          })()}
        </div>
      </header>

      {/* Main Studio Workspace Grid */}
      <div
        className="studio-grid"
        style={{
          display: isMobile ? 'flex' : 'grid',
          flexDirection: isMobile ? 'column' : 'row',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 340px' : '1fr 440px',
        }}
      >
        {/* Left Area: Responsive Video Container */}
        <div
          className="player-card"
          id="playerPanel"
          style={{
            display: isMobile && mobileViewTab !== 'player' ? 'none' : 'flex',
          }}
        >
          {/* Video Player Box */}
          <div
            className="viewfinder"
            id="viewfinderContainer"
            onMouseMove={handleShowControls}
            onMouseLeave={handleHideControls}
          >
            {/* Dynamic Aspect Ratio Viewport */}
            <div
              className="pro-viewport-aspect"
              style={{ aspectRatio: `${aspectRatio}` }}
            >
              <video
                ref={videoRef}
                src={streamUrl}
                onClick={togglePlayPause}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    const w = videoRef.current.videoWidth || 16;
                    const h = videoRef.current.videoHeight || 9;
                    setAspectRatio(w / h);
                    setDuration(videoRef.current.duration || 0);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onStalled={() => setIsBuffering(true)}
                onSeeking={() => setIsBuffering(true)}
                onSeeked={() => setIsBuffering(false)}
                onPlaying={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
              />
            </div>

            {/* Camera Reticle Badges Top Left & Right */}
            <div className="camera-reticle-left">
              <span className={`reticle-dot ${isPlaying ? 'playing' : ''}`} />
              <span>{formatTime(currentTime)}</span>
            </div>
            <div className="camera-reticle-right">
              <span>PRO STUDIO</span>
            </div>

            {/* Center Tap Gesture Play Button */}
            <div
              className={`center-play-tap ${isPlaying ? 'playing' : ''}`}
              onClick={togglePlayPause}
            >
              <div className="play-circle">
                <span>{isPlaying ? '⏸' : '▶'}</span>
              </div>
            </div>
          </div>

          {/* Scrubber Controls Card (Positioned below Viewfinder) */}
          <div className="pro-floating-controls">
            {/* Top Row: Scrubber Slider */}
            <div className="pro-scrubber-row">
              <span className="pro-time-text">{formatTimeShort(currentTime)}</span>
              <div
                className="pro-slider-wrapper"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  if (videoRef.current && duration) {
                    videoRef.current.currentTime = pos * duration;
                  }
                }}
              >
                <div className="pro-slider-fill" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                {/* Comment Timeline Pins */}
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="timeline-marker"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = c.timestamp_sec;
                    }}
                    title={`${c.author_name}: ${c.comment_text}`}
                    style={{
                      left: `${(c.timestamp_sec / (duration || 1)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <span className="pro-time-text muted">{formatTimeShort(duration)}</span>
            </div>

            {/* Bottom Row: Buttons */}
            <div className="pro-controls-row">
              <div className="pro-btn-group">
                <button className="pro-icon-btn" onClick={togglePlayPause} title="Play / Pause">
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button className="pro-icon-btn" onClick={() => stepFrame(-0.04)} title="Step Back 1 Frame">
                  <SkipBack size={12} />
                  <span>1f</span>
                </button>
                <button className="pro-icon-btn" onClick={() => stepFrame(0.04)} title="Step Forward 1 Frame">
                  <SkipForward size={12} />
                  <span>1f</span>
                </button>
              </div>

              <div className="pro-btn-group">
                <select
                  className="pro-select-speed"
                  onChange={(e) => {
                    if (videoRef.current) videoRef.current.playbackRate = parseFloat(e.target.value);
                  }}
                  defaultValue="1.0"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x</option>
                </select>

                <button className="pro-icon-btn" onClick={toggleFullscreen} title="Fullscreen">
                  <Maximize size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Control Deck */}
          <div className="controls-row">

            {/* Playback Controls */}
            <div className="controls-top-bar">
              <div className="controls-button-group">
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      isPlaying ? videoRef.current.pause() : videoRef.current.play();
                    }
                  }}
                  className="btn btn-gradient"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={() => stepFrame(-1 / 30)} className="btn btn-secondary">
                  <SkipBack size={12} /> -1f
                </button>
                <button onClick={() => stepFrame(1 / 30)} className="btn btn-secondary">
                  +1f <SkipForward size={12} />
                </button>
                
                <select className="select-speed" value={videoRef.current?.playbackRate || 1.0} onChange={(e) => { if (videoRef.current) videoRef.current.playbackRate = parseFloat(e.target.value); }}>
                  <option value="0.5">0.5x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x</option>
                </select>
              </div>

              <div className="timecode-badge">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                if (videoRef.current) videoRef.current.pause();
                setIsPlaying(false);
                if (isMobile) setMobileViewTab('notes');
                setTimeout(() => {
                  const input = document.getElementById('commentInput');
                  if (input) {
                    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    input.focus();
                  }
                }, 100);
              }}
            >
              <span>💬 Add Note at {formatTime(currentTime).slice(0, 8)}</span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Chat & Feedback Interface */}
        <div
          className="sidebar-panel"
          id="sidebarPanel"
          style={{
            display: isMobile && mobileViewTab === 'player' ? 'none' : 'flex',
          }}
        >
          {/* Header Tabs */}
          <div className="panel-header">
            <h4>💬 Review Chat</h4>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 12 }}>
              <button
                onClick={() => setActiveTab('messages')}
                style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: activeTab === 'messages' ? 'rgba(255,255,255,0.08)' : 'transparent', color: activeTab === 'messages' ? 'var(--primary)' : '#a0aec0', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Messages ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('participants')}
                style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: activeTab === 'participants' ? 'rgba(255,255,255,0.08)' : 'transparent', color: activeTab === 'participants' ? 'var(--primary)' : '#a0aec0', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
              >
                People
              </button>
            </div>
          </div>

          {/* Chat Feed */}
          <div ref={chatScrollRef} className="comments-scroll">
            {activeTab === 'participants' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div className="author-avatar" style={{ background: 'linear-gradient(135deg, var(--emerald), #00F0FF)', color: '#000', width: 34, height: 34 }}>👑</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Editor (Desktop App)</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 600 }}>● Active Workspace Host</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div className="author-avatar" style={{ background: 'linear-gradient(135deg, var(--accent-purple), var(--primary))', color: '#000', width: 34, height: 34 }}>{authorName ? authorName.charAt(0).toUpperCase() : 'C'}</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{authorName || 'Client'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>● Authenticated Client (You)</div>
                  </div>
                </div>
              </div>
            ) : comments.length === 0 ? (
              <div style={{ color: '#6b7a99', fontSize: '0.85rem', marginTop: '2.5rem', textAlign: 'center', lineHeight: 1.6 }}>
                No feedback notes yet.<br />Write a message below to start real-time review!
              </div>
            ) : (
              comments.map((c) => {
                const isMe = c.author_name.trim().toLowerCase() === authorName.trim().toLowerCase() || (!c.author_name.toLowerCase().includes('editor') && authorName.toLowerCase().includes('client'));
                const isEditor = c.author_name.toLowerCase().includes('editor');
                const cardClass = isEditor ? 'comment-card is-editor' : 'comment-card is-client';
                const clockTime = c.created_at ? new Date(c.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                
                let displayName = '';
                let initial = '';
                if (isEditor) {
                  displayName = c.author_name.replace(/\s*\(Desktop App\)\s*/gi, '').trim();
                  initial = '👑';
                } else {
                  if (c.author_name && c.author_name.trim().toLowerCase() !== 'client') {
                    displayName = c.author_name.trim();
                    initial = c.author_name.trim().charAt(0).toUpperCase();
                  } else if (authorName && authorName.trim().toLowerCase() !== 'client') {
                    displayName = authorName.trim();
                    initial = authorName.trim().charAt(0).toUpperCase();
                  } else {
                    displayName = 'Client';
                    initial = 'C';
                  }
                }

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = c.timestamp_sec;
                    }}
                    className={cardClass}
                  >
                    <div className="comment-top">
                      <span className="comment-author">
                        <span className="author-avatar">{initial}</span>
                        {displayName}
                      </span>
                      <span className="comment-time">⏱ {formatTime(c.timestamp_sec).slice(0, 8)}</span>
                    </div>
                    <div className="comment-body">{c.comment_text}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Typing Notification Banner */}
          {isTyping && (
            <div id="typingIndicator" style={{ display: 'flex' }}>
              <span>💬</span>
              <span>✍️ {typingAuthor} is typing...</span>
              <span style={{ display: 'inline-flex', gap: '3px', fontWeight: 900 }}>
                <span style={{ animation: 'bounce 1.4s infinite 0.2s' }}>●</span>
                <span style={{ animation: 'bounce 1.4s infinite 0.4s' }}>●</span>
                <span style={{ animation: 'bounce 1.4s infinite 0.6s' }}>●</span>
              </span>
            </div>
          )}

          {/* Integrated Feedback Input Bar at Bottom */}
          <div className="form-panel">
            <div className="form-title">
              <span>Leave Feedback Note</span>
              <span id="formTimestamp" style={{ fontFamily: 'JetBrains Mono', color: 'var(--emerald)' }}>⏱ {formatTime(currentTime).slice(0, 8)}</span>
            </div>
            <textarea
              id="commentInput"
              placeholder="Type feedback note at this timestamp..."
              value={commentText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
            />
            <button className="btn btn-gradient" style={{ width: '100%', justifyContent: 'center' }} onClick={handlePostComment}>
              <span>🚀 Submit Note at {formatTime(currentTime).slice(0, 8)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dock */}
      {isMobile && (
        <nav style={{ height: 48, background: '#090b12', borderTop: '1px solid #181d2c', display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexShrink: 0, zIndex: 40 }}>
          <button
            onClick={() => setMobileViewTab('player')}
            style={{ background: 'transparent', border: 'none', color: mobileViewTab === 'player' ? '#00f0ff' : '#718096', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <Video size={16} />
            <span>Player</span>
          </button>
          <button
            onClick={() => { setMobileViewTab('notes'); setActiveTab('messages'); }}
            style={{ background: 'transparent', border: 'none', color: mobileViewTab === 'notes' ? '#00f0ff' : '#718096', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <MessageSquare size={16} />
            <span>Notes ({comments.length})</span>
          </button>
          <button
            onClick={() => { setMobileViewTab('participants'); setActiveTab('participants'); }}
            style={{ background: 'transparent', border: 'none', color: mobileViewTab === 'participants' ? '#00f0ff' : '#718096', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <Users size={16} />
            <span>People</span>
          </button>
        </nav>
      )}
    </div>
  );
}
