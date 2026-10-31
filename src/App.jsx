import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { db, auth } from './firebase/config';
import { getAuth } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Clock } from 'lucide-react';

import { AdminProvider } from './context/AdminContext';
import { useAuth } from './context/AuthContext';
import useStore from './store/useStore';
import usePrefs from './store/usePrefs';
import useNotifications from './store/useNotifications';
import { installGlobalClickSound } from './utils/clickSound';
import { startSiteTextsSync } from './store/useSiteTexts';
import { startInlineStylesSync } from './store/useInlineStyles';
import { startOffersSync } from './store/useOffers';
import { notifyOwner, formatArTime } from './utils/visitorNotify';
import { recordKick } from './utils/kickLog';

import { Login } from './components/Login';
import VerifyEmailGate from './components/VerifyEmailGate';

import BackButton from './components/BackButton';
import CloseButton from './components/CloseButton';
import Navigation from './components/Navigation';
import AIChatWidget from './components/RoyalHome/AIChatWidget';
import WhatsAppFloat from './components/WhatsAppFloat';

import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import OwnerPanel from './pages/OwnerPanel';
import OwnerPrivateRoom from './pages/OwnerPrivateRoom';
import UsersList from './pages/UsersList';

import AdminPage from './components/pages/AdminPage';
import SettingsPage from './components/pages/SettingsPage';
import OTPPage from './components/pages/OTPPage';
import MemberInbox from './components/pages/MemberInbox';
import NotificationPanel from './components/NotificationPanel';

import ComplaintsPage from './components/pages/ComplaintsPage';
import './styles/global.css';

// ⭐ إضافة صفحة الأسئلة الشائعة
import FAQ from './pages/FAQ';


/* =========================================================
   Lazy Pages
   ========================================================= */

const chunkReloadKey = 'chunkReloadOnce';

const safeLazy = (importer) =>
  lazy(() =>
    importer().catch((err) => {
      if (!sessionStorage.getItem(chunkReloadKey)) {
        sessionStorage.setItem(chunkReloadKey, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      throw err;
    })
  );

window.addEventListener('load', () => {
  setTimeout(() => {
    sessionStorage.removeItem(chunkReloadKey);
  }, 10000);
});

const Dashboard = safeLazy(() => import('./pages/Dashboard'));
const RoyalHomePage = safeLazy(() =>
  import('./components/RoyalHome/NovHomePage')
);
const CatalogPage = safeLazy(() =>
  import('./components/RoyalHome/CatalogPage')
);
const ContactPage = safeLazy(() =>
  import('./components/RoyalHome/ContactPage')
);
const RoyalHarajPage = safeLazy(() =>
  import('./components/RoyalHome/RoyalHarajPage')
);
const AdFormPage = safeLazy(() =>
  import('./components/RoyalHome/AdFormPage')
);
const BranchDetail = safeLazy(() => import('./pages/BranchDetail'));
const BranchesManagement = safeLazy(() =>
  import('./pages/BranchesManagement')
);
const AdvertisementsPage = safeLazy(() =>
  import('./pages/AdvertisementsPage')
);
const EmployeesPage = safeLazy(() => import('./pages/EmployeesPage'));
const AboutPage = safeLazy(() => import('./pages/AboutPage'));
const AIChat = safeLazy(() => import('./components/AIChat'));
const AdDetailsPage = safeLazy(() => import('./pages/AdDetailsPage'));
const ChatPage = safeLazy(() => import('./pages/ChatPage'));
const TermsPage = safeLazy(() => import('./pages/TermsPage'));
const WantedDressPage = safeLazy(() => import('./pages/WantedDressPage'));

/* =========================================================
   Owner Broadcast
   ========================================================= */

const OWNER_WELCOME_MESSAGE =
  'تم تسجيل دخول صاحب موقع "المسيمير | ALMUSAYMIR" ويُرحّب بكم جميعاً ويتمنى لكم تجربة تسوّق ممتعة ترضي ذائقتكم الرفيعة. يُذكِّركم بأن من لديه اقتراح أو ملاحظة أو شكوى على أحد موظفي الموقع أو على أي شخص بسبب النصب أو الاحتيال، يتوجّه إلى غرفة صاحب موقع "المسيمير | ALMUSAYMIR" ويتقدّم برسالة مفصّلة. وفي حال كانت الشكوى نصب واحتيال فسيتم اتخاذ الإجراءات اللازمة فوراً، سواء من قِبَل صاحب الموقع أو بإحالة الموضوع إلى الجهات الأمنية المختصّة بشكل عاجل، حفاظاً على حقوقكم وسلامة تعاملاتكم. المسيمير | ALMUSAYMIR — حيث الأناقة تلتقي بالثقة.';

const OWNER_EMAILS = new Set(
  (
    import.meta.env.VITE_OWNER_EMAILS ||
    import.meta.env.VITE_ADMIN_EMAILS ||
    'f882771f@gmail.com,kal6667222@gmail.com'
  )
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const OWNER_ALERT_SOUND_URL =
  import.meta.env.VITE_OWNER_SOUND_URL || '/sounds/welcome.mp3';

const SOUND_DURATION_SECONDS =
  Number(import.meta.env.VITE_SOUND_DURATION_SECONDS) || 10;

/* =========================================================
   Fixed bars heights
   ========================================================= */

const OWNER_BANNER_HEIGHT = 48;

/* =========================================================
   Loading
   ========================================================= */

const LoadingScreen = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: 'var(--rz-primary)',
      fontSize: '1.5rem',
      fontFamily: 'Tajawal',
      direction: 'rtl',
    }}
  >
    جاري التحميل...
  </div>
);

/* =========================================================
   Security log
   ========================================================= */

const logIntrusionAttempt = (path) => {
  try {
    const key = `rooz_intrusion_${path}`;

    if (sessionStorage.getItem(key)) return;

    sessionStorage.setItem(key, '1');

    addDoc(collection(db, 'security_logs'), {
      type: 'unauthorized_access_attempt',
      details: `محاولة دخول غير مصرح بها إلى: ${path}`,
      severity: 'high',
      timestamp: serverTimestamp(),
      userId: auth?.currentUser?.uid || null,
      userEmail: auth?.currentUser?.email || null,
    }).catch(() => {});
  } catch {
    // التسجيل هامشي — لا يعطّل التحويل
  }
};

/* =========================================================
   Unauthorized
   ========================================================= */

const UnauthorizedPage = () => {
  const location = useLocation();

  useEffect(() => {
    logIntrusionAttempt(location.pathname);
  }, [location.pathname]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: 'Tajawal',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
          background: 'linear-gradient(160deg, var(--rz-ivory), var(--rz-ivory))',
          border: '2px solid var(--rz-primary)',
          borderRadius: 20,
          padding: '2.2rem 1.6rem',
          boxShadow: '0 18px 50px rgba(var(--rz-ink-rgb), 0.22)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 14px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--rz-primary), var(--rz-primary))',
            boxShadow: '0 8px 22px rgba(var(--rz-primary-rgb), 0.35)',
            fontSize: 30,
          }}
        >
          🔒
        </div>

        <h1
          style={{
            margin: '0 0 10px',
            color: 'var(--rz-primary)',
            fontWeight: 900,
            fontSize: '1.4rem',
          }}
        >
          غير مصرح لك بالدخول
        </h1>

        <p
          style={{
            margin: 0,
            color: 'var(--rz-ink)',
            fontWeight: 600,
            lineHeight: 1.9,
            fontSize: '0.95rem',
          }}
        >
          هذه الصفحة مخصصة لصاحب موقع «المسيمير | ALMUSAYMIR» فقط، وهي محمية بحماية
          مشددة.
          <br />
          تم تسجيل محاولة الوصول هذه في سجل الأمان.
        </p>
      </div>
    </div>
  );
};

/* =========================================================
   Protected Route
   ========================================================= */

const ProtectedRoute = ({ children, roleRequired }) => {
  const { user, userRole, isAuthenticated } = useAuth();
  const guestSession = useStore((state) => state.guestSession);

  const liveAuth =
    auth ||
    (() => {
      try {
        return getAuth();
      } catch {
        return null;
      }
    })();

  const currentFirebaseUser = liveAuth?.currentUser || null;
  const hasFirebaseSession = !!currentFirebaseUser;

  // الشرط الوحيد لفتح أي مسار: عضو حقيقي (ليس مجهولاً) بريده موثّق.
  // لا جلسة زائر ولا جلسة مجهولة تمنح وصولاً بعد الآن.
  const memberUser = currentFirebaseUser || user;
  const isVerifiedMember =
    !!memberUser?.emailVerified && !memberUser?.isAnonymous;
  const isActiveGuest =
    !!guestSession?.active &&
    !!currentFirebaseUser?.isAnonymous &&
    Number(guestSession.expiresAt || 0) > Date.now();

  const sessionPending =
    hasFirebaseSession &&
    (!isAuthenticated || (!!roleRequired && !userRole));

  const [pendingExpired, setPendingExpired] = useState(false);

  useEffect(() => {
    if (!sessionPending) {
      setPendingExpired(false);
      return undefined;
    }

    const id = setTimeout(() => {
      setPendingExpired(true);
    }, 12000);

    return () => clearTimeout(id);
  }, [sessionPending]);

  if (sessionPending && !pendingExpired) {
    return <LoadingScreen />;
  }

  // عضو مسجّل لكن بريده لم يُوثَّق → شاشة إثبات الملكية، ولا محتوى للمتجر.
  if (hasFirebaseSession && !isVerifiedMember) {
    if (isActiveGuest && !roleRequired) {
      return children;
    }
    return <VerifyEmailGate />;
  }

  if (!isVerifiedMember) {
    recordKick('protected-route-no-session', {
      roleRequired: roleRequired || null,
      isAuthenticated,
      hasFirebaseSession,
      pendingExpired,
      userRole: userRole || null,
    });

    return <Navigate to="/login" replace />;
  }

  if (roleRequired && userRole !== roleRequired) {
    const isOwnerAccount =
      roleRequired === 'owner' &&
      OWNER_EMAILS.has(
        String(
          user?.email ||
            currentFirebaseUser?.email ||
            ''
        ).toLowerCase()
      );

    if (!isOwnerAccount) {
      recordKick('protected-route-unauthorized', {
        roleRequired,
        userRole: userRole || null,
        email:
          user?.email ||
          currentFirebaseUser?.email ||
          null,
      });

      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

/* مسار الدخول: يعرض النموذج لغير المسجّل، ويحوّل المسجّل الموثّق إلى الرئيسية.
   الشرط الوحيد: حساب حقيقي (ليس مجهولاً) بريده موثّق. العضو غير الموثّق يبقى
   في شاشة إثبات الملكية (VerifyEmailGate) التي يعرضها ProtectedRoute. */
const LoginRoute = ({ isVerifiedMember, children }) => {
  if (isVerifiedMember) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/* =========================================================
   App Content
   ========================================================= */

function AppContent() {
  const {
    user,
    isAuthenticated,
    userRole,
    logout,
    loading,
  } = useAuth();
  const guestSession = useStore((state) => state.guestSession);
  const guestWarning = useStore((state) => state.guestWarning);

  const navigate = useNavigate();
  const location = useLocation();

  // الشرط الوحيد لفتح الموقع أو تحويل المستخدم بعيداً عن /login:
  // حساب حقيقي (ليس مجهولاً) بريده موثّق. لا جلسة زائر ولا جلسة مجهولة.
  const liveFirebaseUser = auth?.currentUser || user;
  const isVerifiedMember =
    !!liveFirebaseUser?.emailVerified && !liveFirebaseUser?.isAnonymous;

  // ربط زر الإغلاق العام (❌) بمُوجّه react-router — فيتنقل خطوة للخلف
  // داخلياً دون إعادة تحميل أو مغادرة الموقع.
  useEffect(() => {
    window.__ROOZ_NAV__ = (url, replace) => {
      navigate(url, { replace: !!replace });
    };
    return () => {
      delete window.__ROOZ_NAV__;
    };
  }, [navigate]);

  // تفاعل وهج الخلفية مع المؤشر + إيقاف الحركة عند إخفاء الصفحة.
  // للأجهزة ذات المؤشر الدقيق فقط، ويكتب متغيّرات CSS مباشرة (بلا re-render)،
  // وينظّف كل المستمعات عند الإزالة.
  const pearlLayerRef = useRef(null);
  useEffect(() => {
    const el = pearlLayerRef.current;
    if (!el) return undefined;
    const mq = window.matchMedia;
    const reduceMotion = mq && mq('(prefers-reduced-motion: reduce)').matches;

    // إيقاف/استئناف حركة الأشكال مع خفاء التبويب => لا استهلاك في الخلفية
    const onVisibility = () => el.classList.toggle('rzp-paused', document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();

    const finePointer = mq && mq('(hover: hover) and (pointer: fine)').matches;
    let onMove;
    let raf = 0;
    if (finePointer && !reduceMotion) {
      el.classList.add('is-interactive');
      onMove = (e) => {
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          el.style.setProperty('--rzp-mx', `${e.clientX}px`);
          el.style.setProperty('--rzp-my', `${e.clientY}px`);
        });
      };
      window.addEventListener('pointermove', onMove, { passive: true });
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (onMove) window.removeEventListener('pointermove', onMove);
      if (raf) window.cancelAnimationFrame(raf);
      el.classList.remove('is-interactive');
    };
  }, []);

  // حفظ آخر مسار داخلي قبل الصفحة الحالية (ليستخدمه زر الرجوع بأمان
  // بدل navigate(-1) الذي قد يعيد لصفحة خاطئة أو خارج الموقع)
  const prevPathRef = useRef(null);

  useEffect(() => {
    const current = location.pathname;

    const pathsToSkip = new Set(['/', '/login', '/register', '/forgot-password', '/unauthorized']);

    if (prevPathRef.current && prevPathRef.current !== current) {

      window.history.replaceState(
        {
          ...window.history.state,
          prevPath: prevPathRef.current,
        },
        ''
      );
    }

    if (!pathsToSkip.has(current)) {
      prevPathRef.current = current;
    }
  }, [location.pathname]);

  /* =======================================================
     Dynamic page titles
     ======================================================= */

  useEffect(() => {
    const TITLES = {
      '/': 'المسيمير | ALMUSAYMIR | متجر شامل وحراج إعلانات',
      '/haraj': 'حراج المسيمير | إعلانات موثوقة لكل السلع',
      '/catalog/electronics': 'إلكترونيات | المسيمير',
      '/catalog/mobiles': 'جوالات وإكسسوارات | المسيمير',
      '/catalog/home-appliances': 'أجهزة منزلية | المسيمير',
      '/catalog/fashion': 'أزياء وموضة | المسيمير',
      '/catalog/kids': 'أطفال | المسيمير',
      '/catalog/beauty': 'جمال وعناية | المسيمير',
      '/catalog/sports': 'رياضة | المسيمير',
      '/catalog/cars': 'سيارات وإكسسوارات | المسيمير',
      '/catalog/home-supplies': 'مستلزمات منزلية | المسيمير',
      '/catalog/services': 'خدمات | المسيمير',
      '/catalog/others': 'متنوعات | المسيمير',
      '/contact': 'تواصل معنا | المسيمير',
      '/terms': 'شروط وأحكام الاستخدام | المسيمير',
      '/wanted-dress': 'الطلبات الخاصة | المسيمير',
    };

    const title = TITLES[location.pathname];

    if (title) {
      document.title = title;
    }
  }, [location.pathname]);

  // تنقّل ثابت بين الصفحات: لا توجد شرائح أفقية أو صفحات متراكبة.
  // عند اختيار رابط من الترويسة أو القائمة يبدأ المسار الجديد من أعلاه.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (!/jsdom/i.test(window.navigator?.userAgent || '')) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [location.pathname]);

  /* =======================================================
     Visitor notification
     ======================================================= */

  useEffect(() => {
    if (
      window.sessionStorage.getItem(
        'rooz_visit_notified'
      )
    ) {
      return;
    }

    window.sessionStorage.setItem(
      'rooz_visit_notified',
      '1'
    );

    notifyOwner(
      'زائر جديد دخل الموقع',
      `وقت الدخول: ${formatArTime()}`
    );
  }, []);

  /* =======================================================
     Preferences + global click sound
     ======================================================= */

  useEffect(() => {
    usePrefs.getState().applyAll();

    startSiteTextsSync();
    startInlineStylesSync();
    startOffersSync();

    return installGlobalClickSound();
  }, []);

  /* =======================================================
     Broadcast history
     ======================================================= */

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    fetch('/api/broadcast?history=1', {
      cache: 'no-store',
    })
      .then((res) =>
        res.ok ? res.json() : null
      )
      .then((data) => {
        if (
          !cancelled &&
          Array.isArray(data?.items)
        ) {
          useNotifications
            .getState()
            .syncFromServer(data.items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================================================
     Notify owner on member login/logout
     ======================================================= */

  const prevUserEmailRef = useRef(null);

  useEffect(() => {
    const email = user?.email || null;
    const prev = prevUserEmailRef.current;

    if (usePrefs.getState().incognito) {
      prevUserEmailRef.current = email;
      return;
    }

    if (email && email !== prev) {
      notifyOwner(
        'عضو سجّل دخوله',
        `البريد: ${email} — وقت الدخول: ${formatArTime()}`
      );
    } else if (!email && prev) {
      notifyOwner(
        'عضو غادر الموقع',
        `البريد: ${prev} — وقت الخروج: ${formatArTime()}`
      );
    }

    prevUserEmailRef.current = email;
  }, [user]);

  /* =======================================================
     Owner banner
     ======================================================= */

  // شريط ترحيب المالك — يظهر فقط عند كل تسجيل دخول ناجح لصاحب الموقع،
  // يلف الشريط ٣ لفات كاملة ثم يتوقف (بلا تخزين دائم ولا 24 ساعة)..
  const [ownerWelcomeBanner, setOwnerWelcomeBanner] =
    useState(null);

  // إخفاء شريط ترحيب المالك تلقائيًا بعد ٣ لفات كاملة (300 ثانية = 3×100 ثانية)..
  useEffect(() => {
    if (!ownerWelcomeBanner) return;
    const t = setTimeout(() => {
      setOwnerWelcomeBanner(null);
    }, 300000);
    return () => clearTimeout(t);
  }, [ownerWelcomeBanner]);

  /* =======================================================
     Owner message / audio
     ======================================================= */

  const [ownerWelcomeMessage, setOwnerWelcomeMessage] =
    useState(OWNER_WELCOME_MESSAGE);

  const isOwnerLoggedIn =
    userRole === 'owner';

  const audioRef = useRef(null);
  const audioTimerRef = useRef(null);
  const lastBroadcastIdRef = useRef(null);

  /* =======================================================
     AI Chat open state
     ======================================================= */

  const [aiChatOpen, setAiChatOpen] = useState(false);

  /* =======================================================
     Logout
     ======================================================= */

  const handleLogout = async () => {
    try {
      setOwnerWelcomeBanner(null);
      await logout();
      navigate('/login');
    } catch (error) {
      console.error(
        'خطأ في تسجيل الخروج:',
        error
      );
    }
  };

  /* =======================================================
     Owner announcement
     ======================================================= */

  const announceOwnerWelcome =
    useCallback(
      (
        message = OWNER_WELCOME_MESSAGE
      ) => {
        const nowTs = Date.now();

        const bannerData = {
          msg: message,
          at: nowTs,
        };

        setOwnerWelcomeBanner(
          bannerData
        );

        setOwnerWelcomeMessage(
          message
        );

        if (
          audioRef.current &&
          usePrefs.getState().welcomeSound
        ) {
          try {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;

            const playPromise =
              audioRef.current.play();

            if (
              playPromise &&
              typeof playPromise.catch ===
                'function'
            ) {
              playPromise.catch(() => {});
            }
          } catch {
            // ignore audio errors
          }
        }

        if (audioTimerRef.current) {
          window.clearTimeout(
            audioTimerRef.current
          );
        }

        audioTimerRef.current =
          window.setTimeout(() => {
            if (audioRef.current) {
              try {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              } catch {
                // ignore
              }
            }
          }, SOUND_DURATION_SECONDS * 1000);
      },
      []
    );

  /* =======================================================
     Broadcast polling
     ======================================================= */

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          '/api/broadcast',
          {
            cache: 'no-store',
          }
        );

        if (!res.ok) return;

        const data =
          await res.json().catch(
            () => ({})
          );

        if (
          cancelled ||
          !data ||
          !data.id ||
          !data.message
        ) {
          return;
        }

        useNotifications
          .getState()
          .syncFromServer([data]);

        if (
          lastBroadcastIdRef.current ===
          data.id
        ) {
          return;
        }

        lastBroadcastIdRef.current =
          data.id;

        const type = String(
          data.type || 'general'
        );

        if (
          type === 'owner-entry' ||
          type === 'general'
        ) {
          announceOwnerWelcome(
            data.message
          );
        }
      } catch {
        // network errors ignored
      }
    };

    poll();

    let intervalId = null;

    const startPolling = () => {
      if (intervalId === null) {
        intervalId =
          setInterval(
            poll,
            5000
          );
      }
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        poll();
        startPolling();
      }
    };

    startPolling();

    document.addEventListener(
      'visibilitychange',
      onVisibility
    );

    return () => {
      cancelled = true;

      stopPolling();

      document.removeEventListener(
        'visibilitychange',
        onVisibility
      );

      if (audioTimerRef.current) {
        window.clearTimeout(
          audioTimerRef.current
        );
      }
    };
  }, [announceOwnerWelcome]);

  /* =======================================================
     Immediate owner login event
     ======================================================= */

  useEffect(() => {
    const onOwnerLoggedIn =
      (event) => {
        const detail =
          event?.detail || {};

        if (detail.id != null) {
          lastBroadcastIdRef.current =
            detail.id;
        }

        announceOwnerWelcome(
          typeof detail.message ===
            'string' &&
            detail.message.trim()
            ? detail.message
            : OWNER_WELCOME_MESSAGE
        );
      };

    window.addEventListener(
      'ownerLoggedIn',
      onOwnerLoggedIn
    );

    return () =>
      window.removeEventListener(
        'ownerLoggedIn',
        onOwnerLoggedIn
      );
  }, [announceOwnerWelcome]);

  /* =======================================================
     Owner role safety announcement
     ======================================================= */

  const ownerBaselineRef =
    useRef(false);

  const prevUserRoleRef =
    useRef(null);

  useEffect(() => {
    if (loading) return;

    if (userRole !== 'owner') {
      prevUserRoleRef.current = userRole;
      return;
    }

    // صفحة تسجيل الدخول: لا شريط ولا صوت — ننتظر حتى يخرج منها
    if (location.pathname === '/login') return;

    if (!ownerBaselineRef.current) {
      ownerBaselineRef.current = true;
      prevUserRoleRef.current = userRole;
      announceOwnerWelcome(OWNER_WELCOME_MESSAGE);
      return;
    }

    if (prevUserRoleRef.current !== 'owner') {
      announceOwnerWelcome(OWNER_WELCOME_MESSAGE);
    }

    prevUserRoleRef.current = userRole;
  }, [
    userRole,
    loading,
    location.pathname,
    announceOwnerWelcome,
  ]);


  /* =======================================================
     Loading
     ======================================================= */

  if (loading) {
    return <LoadingScreen />;
  }

  /* =======================================================
     Chat direct protection
     ======================================================= */

  // ملاحظة: يمنع هذا الحاجز وصول أي مستخدم غير موثّق (لا عضو ولا زائر)
  // إلى /chat. كان سابقاً يعرض نصاً بلون كريمي على خلفية كريمية فيبدو
  // كصفحة فارغة معطّلة — نوجّه الآن إلى /login مثل بقية المسارات المحمية.
  if (
    !user &&
    !isAuthenticated &&
    window.location.pathname.startsWith(
      '/chat'
    )
  ) {
    return <Navigate to="/login" replace />;
  }

  /* =======================================================
     MAIN APPLICATION
     ======================================================= */

  // كثافة الخلفية اللؤلؤية حسب الصفحة (واجهة فقط — لا يمسّ التوجيه أو المنطق)
  const pearlSurface = (() => {
    const p = location.pathname;
    if (p === '/' || p === '/dashboard' || p === '/home') return 'home';
    if (p.startsWith('/catalog') || p.startsWith('/branches') || p === '/products') return 'catalog';
    if (p.startsWith('/haraj') || p.startsWith('/ads') || p.startsWith('/advertisements') || p === '/ad/:id') return 'haraj';
    return 'none';
  })();

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        /* شفاف ليظهر غلاف الموقع فوق صورة المدينة (الخلفية في rooz-site-backdrop.css) */
        background: 'transparent',
        color: 'var(--rz-ink)',
        fontFamily: 'Tajawal',
        position: 'relative',
      }}
    >
      {/* =================================================
          طبقة خلفية لؤلؤية ثلاثية الأبعاد (زخرفية بحتة)
          ثابتة، pointer-events:none، خلف كل المحتوى (z-index:0)
          ================================================= */}
      <div
        ref={pearlLayerRef}
        className="rz-pearl-layer"
        data-pearl={pearlSurface}
        aria-hidden="true"
      >
        <div className="rz-pearl-blob b1" />
        <div className="rz-pearl-blob b2" />
        <div className="rz-pearl-blob b3" />
        <div className="rz-pearl-blob b4" />
        <div className="rz-pearl-flow" />
        <div className="rz-pearl-grid" />
        <div className="rz-pearl-veil" />
      </div>

      {/* =================================================
          Global animations
          ================================================= */}

      <style>{`

        :root {
          --rooz-header-h: 76px;
        }

        @media (max-width: 900px) {
          :root {
            --rooz-header-h: 60px;
          }
        }

        @keyframes ownerGlobalTicker {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100vw); }
        }

@keyframes roozCrown3D {
  0%   { transform: perspective(600px) rotateY(0deg) scale(1); filter: drop-shadow(0 0 4px rgba(var(--rz-primary-rgb), 0.9)); }
  50%  { transform: perspective(600px) rotateY(360deg) scale(1.12); filter: drop-shadow(0 0 14px rgba(var(--rz-primary-rgb), 1)); }
  100% { transform: perspective(600px) rotateY(720deg) scale(1); filter: drop-shadow(0 0 4px rgba(var(--rz-primary-rgb), 0.9)); }
}

@keyframes roozStar3D {
  0%   { transform: perspective(400px) rotateX(0deg) scale(0.85); opacity:  0.75; }
  25%  { transform: perspective(400px) rotateX(45deg) scale(1.2); opacity:  1; }
  50%  { transform: perspective(400px) rotateX(-45deg) scale(0.9); opacity:  1; }
  75%  { transform: perspective(400px) rotateX(20deg) scale(1.15); opacity:  1; }
  100% { transform: perspective(400px) rotateX(0deg) scale(0.85); opacity:  0.75; }
}

        .rooz-app-main {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        .rooz-page-content {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          position: relative;
          z-index: 1;
          box-sizing: border-box;
        }

        @media (max-width: 768px) {
          .rooz-page-content {
            width: 100%;
            min-width: 0;
            max-width: 100%;
          }
        }

      `}</style>

      {/* =================================================
          Owner welcome audio
          ================================================= */}

      <audio
        ref={audioRef}
        src={OWNER_ALERT_SOUND_URL}
        preload="auto"
      />

      {guestSession?.active && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 'calc(8px + env(safe-area-inset-top))',
            left: 12,
            right: 12,
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '9px 12px',
            borderRadius: 12,
            background: guestWarning
              ? 'rgba(179, 38, 30, 0.96)'
              : 'rgba(var(--rz-primary-rgb), 0.96)',
            color: 'var(--rz-white)',
            fontSize: 12,
            fontWeight: 800,
            textAlign: 'center',
            boxShadow: '0 8px 22px rgba(0,0,0,.18)',
          }}
        >
          {guestWarning
            ? 'تنبيه: تبقى أقل من 15 ثانية على انتهاء دخول الزائر.'
            : 'دخولك مؤقت لمدة دقيقتين فقط. أنشئ حسابًا أو سجّل الدخول للاستفادة من جميع الخدمات.'}
        </div>
      )}


      {/* =================================================
          Navigation
          ================================================= */}

      {isVerifiedMember && (
        <Navigation
          user={user}
          onLogout={handleLogout}
          onOpenAIChat={() => setAiChatOpen(true)}
        />
      )}

      {/* ================================================= */}
      {/* Floating Back Button */}
      {/* ================================================= */}

      <BackButton />

      {/* =================================================
          Global Close Button (❌) — يظهر في الصفحات الفرعية
          واللوحات/التبويبات، ولا يظهر في الجذر/المصادقة.
          اللوحات الداخلية (الإدارة/غرفة المالك) توفّر زرها الخاص.
          ================================================= */}

      {/* CloseButton معطل — زر الرجوع وحده لتجنب التداخل */}

      {/* =================================================
          AI assistant
          ================================================= */}

      {isAuthenticated && (
        <AIChatWidget
          topOffset={
            ownerWelcomeBanner ? OWNER_BANNER_HEIGHT : 0
          }
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
        />
      )}

      {/* =================================================
          WhatsApp
          ================================================= */}

      {location.pathname !==
        '/login' && (
        <WhatsAppFloat />
      )}

      {/* =================================================
          MAIN PAGE CONTENT
          ================================================= */}

      <main
        className="rooz-app-main"
        style={{
          flex: '1 1 auto',
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
          paddingTop: isAuthenticated ? 'var(--nav-height, 56px)' : 0,
          marginTop: 0,
        }}
      >

        {/* =================================================
            Owner welcome ticker
            - يظهر فوق الشعار مباشرة داخل محتوى الصفحة الرئيسية
            - يظهر الرسالة كاملة من البداية
            - الاتجاه صحيح (من اليمين لليسار)
            - يمر 3 مرات متتالية فقط ثم يختفي
            - يظهر مع كل تسجيل دخول لصاحب الموقع
            ================================================= */}

        {ownerWelcomeBanner && location.pathname === '/' && (
          <div
            dir="rtl"
            style={{
              position: 'relative',
              left: 0,
              right: 0,
              width: '100%',
              height: '60px',
              overflow: 'hidden',
              display: 'block',
              background: 'linear-gradient(90deg, var(--rz-ink) 0%, var(--rz-ink) 40%, var(--rz-ink) 60%, var(--rz-ink) 100%)',
              borderTop: '2px solid var(--rz-primary)',
              borderBottom: '2px solid var(--rz-primary)',
              boxShadow: '0 12px 32px rgba(var(--rz-ink-rgb), 0.6), 0 0 22px rgba(var(--rz-primary-rgb), 0.25)',
              zIndex: 80,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '60px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 'max-content',
                  minWidth: 'max-content',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  animation: 'ownerGlobalTicker 32s linear 3',
                  willChange: 'transform',
                }}
                onAnimationEnd={() => {
                  setOwnerWelcomeBanner(null);
                }}
              >
                <b
                  style={{
                    display: 'block',
                    flexShrink: 0,
                    padding: '0 60px',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Tajawal, "Noto Sans Arabic", Tahoma, sans-serif',
                    fontSize: 'clamp(1.15rem, 2.5vw, 1.55rem)',
                    fontWeight: 900,
                    WebkitTextStroke: '0.4px rgba(var(--rz-champagne-rgb), 0.5)',
                    lineHeight: '60px',
                    direction: 'rtl',
                    unicodeBidi: 'isolate',
                    color: 'var(--rz-champagne)',
                    WebkitTextFillColor: 'var(--rz-champagne)',
                    textShadow: '0 1px 2px rgba(var(--rz-black-rgb), 0.45)',
                  }}
                >
                  {ownerWelcomeBanner?.msg || OWNER_WELCOME_MESSAGE}
                </b>
              </div>
            </div>
          </div>
        )}

        <div
          className="rooz-page-content"
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            position: 'relative',
            zIndex: 1,
            boxSizing: 'border-box',
          }}
        >
          <Suspense
            fallback={
              <LoadingScreen />
            }
          >
            <Routes>

              <Route
                path="/login"
                element={
                  <LoginRoute isVerifiedMember={isVerifiedMember}>
                    <Login />
                  </LoginRoute>
                }
              />

              <Route
                path="/unauthorized"
                element={
                  <UnauthorizedPage />
                }
              />

              <Route
                path="/register"
                element={
                  <Register />
                }
              />

              <Route
                path="/forgot-password"
                element={
                  <ForgotPassword />
                }
              />

              <Route
                path="/contact"
                element={
                  <ProtectedRoute>
                    <ContactPage />
                  </ProtectedRoute>
                }
              />

              {/* الرئيسية: محمية بالكامل — لا تُعرض إلا لحساب موثّق البريد. */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RoyalHomePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/catalog/:catalogId"
                element={
                  <ProtectedRoute>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/branches"
                element={
                  <ProtectedRoute>
                    <BranchesManagement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/branch/:id"
                element={
                  <ProtectedRoute>
                    <BranchDetail />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/advertisements"
                element={
                  <ProtectedRoute>
                    <AdvertisementsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ad/:id"
                element={
                  <ProtectedRoute>
                    <AdDetailsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/haraj/ad/:id"
                element={
                  <ProtectedRoute>
                    <AdDetailsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/employees"
                element={
                  <ProtectedRoute>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/complaints"
                element={
                  <ProtectedRoute
                    roleRequired="owner"
                  >
                    <ComplaintsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/ai-chat"
                element={
                  <ProtectedRoute>
                    <AIChat />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/haraj"
                element={
                  <ProtectedRoute>
                    <RoyalHarajPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/haraj/catalog/:catalogId"
                element={
                  <ProtectedRoute>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/haraj/post"
                element={
                  <ProtectedRoute>
                    <AdFormPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/about"
                element={
                  <ProtectedRoute>
                    <AboutPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute
                    roleRequired="owner"
                  >
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/inbox"
                element={
                  <ProtectedRoute>
                    <MemberInbox />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/otp"
                element={
                  <ProtectedRoute>
                    <OTPPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/users"
                element={
                  <ProtectedRoute>
                    <UsersList />
                  </ProtectedRoute>
                }
              />

              {/* ⭐ مسار الأسئلة الشائعة الجديد */}
              <Route
                path="/faq"
                element={
                  <ProtectedRoute>
                    <FAQ />
                  </ProtectedRoute>
                }
              />

              {/* ⭐ صفحة الشروط والأحكام */}
              <Route
                path="/terms"
                element={
                  <ProtectedRoute>
                    <TermsPage />
                  </ProtectedRoute>
                }
              />

              {/* ⭐ صفحة الطلبات الخاصة (الخصائص الذكية) */}
              <Route
                path="/wanted-dress"
                element={
                  <ProtectedRoute>
                    <WantedDressPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationPanel />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner-room"
                element={
                  <Navigate
                    to="/owner-private-room"
                    replace
                  />
                }
              />

              <Route
                path="/owner-private-room"
                element={
                  <ProtectedRoute
                    roleRequired="owner"
                  >
                    <OwnerPrivateRoom />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/owner-panel"
                element={
                  <ProtectedRoute
                    roleRequired="owner"
                  >
                    <OwnerPanel />
                  </ProtectedRoute>
                }
              />

              <Route
                path="*"
                element={
                  <Navigate
                    to={isAuthenticated ? '/' : '/login'}
                    replace
                  />
                }
              />

            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
APP
========================================================= */

export default function App() {
  return (
    <AdminProvider>
      <AppContent />
    </AdminProvider>
  );
}
