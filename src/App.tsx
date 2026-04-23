/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Role, AssessmentData } from './types';
import { LogOut, GraduationCap, BookOpen, User as UserIcon, LayoutDashboard, Loader2, Users, Target, Mail, School, Award, CheckCircle, Bot, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AssessmentForm from './components/AssessmentForm';
import TeacherDashboard from './components/TeacherDashboard';
import RoadmapView from './components/RoadmapView';
import AITutor from './components/AITutor';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'assessment' | 'roadmap' | 'dashboard' | 'aitutor'>('home');
  const [hasSetInitialView, setHasSetInitialView] = useState(false);
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [latestAssessment, setLatestAssessment] = useState<AssessmentData | null>(null);

  // Set initial view based on role once after login
  useEffect(() => {
    if (user && !hasSetInitialView) {
      setView(user.role === 'teacher' ? 'dashboard' : 'home');
      setHasSetInitialView(true);
    } else if (!user) {
      setHasSetInitialView(false);
      setView('home');
    }
  }, [user, hasSetInitialView]);

  useEffect(() => {
    const fetchLatestAssessment = async () => {
      if (!user) return; // Allow both student and teacher to fetch their own assessment for demo
      try {
        const q = query(
          collection(db, 'assessments'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setLatestAssessment(querySnapshot.docs[0].data() as AssessmentData);
        }
      } catch (error) {
        console.error("Error fetching latest assessment:", error);
      }
    };

    if (view === 'home' || view === 'roadmap') {
      fetchLatestAssessment();
    }
  }, [user, view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          // Ensure correct role if it's the default admin email
          if (firebaseUser.email === 'minhkhoiklk@gmail.com' && userData.role !== 'teacher') {
            const updatedUser = { ...userData, role: 'teacher' as const };
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser, { merge: true });
            setUser(updatedUser);
          } else {
            setUser(userData);
          }
        } else {
          // New user registration
          const isGuestAdmin = firebaseUser.isAnonymous;
          const isDefaultAdmin = firebaseUser.email === 'minhkhoiklk@gmail.com';
          
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || (isGuestAdmin ? 'admin@demo.app' : ''),
            fullName: isGuestAdmin ? 'Quản trị viên (Demo)' : (firebaseUser.displayName || 'Học sinh'),
            role: (isDefaultAdmin || isGuestAdmin) ? 'teacher' : 'student',
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Clear flag just in case
      sessionStorage.removeItem('isGuestAdmin');
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const [showGuestLogin, setShowGuestLogin] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  const handleGuestLogin = async () => {
    // Secret code only GV knows
    if (accessCode === 'Admin') {
      try {
        setLoading(true);
        sessionStorage.setItem('isGuestAdmin', 'true');
        await signInAnonymously(auth);
        setShowGuestLogin(false);
        setAccessCode('');
      } catch (error) {
        console.error("Guest login failed:", error);
        alert("Có lỗi xảy ra khi đăng nhập Demo.");
        setLoading(false);
      }
    } else {
      alert("Mã truy cập không chính xác!");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isGuestAdmin');
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl w-full relative z-10"
        >
          {/* Logo Section */}
          <div className="text-center mb-10">
            <div className="bg-white w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100 rotate-3 border border-border-main">
              <GraduationCap className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-4xl font-black text-text-main mb-2 tracking-tighter uppercase">MATHCONQUER</h1>
            <p className="text-text-sub max-w-lg mx-auto font-medium">Hệ thống xây dựng lộ trình ôn tập Toán 12 cá nhân hóa bằng trí tuệ nhân tạo.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Student Column */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="geometric-card !p-8 flex flex-col items-center text-center bg-white border-b-4 border-b-primary"
            >
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-black text-text-main mb-3 uppercase tracking-tight">Dành cho Học sinh</h2>
              <p className="text-sm text-text-sub mb-8 leading-relaxed">Đăng nhập để thực hiện khảo sát năng lực, nhận lộ trình cá nhân hóa và bắt đầu học cùng Gia sư AI.</p>
              
              <button
                onClick={handleLogin}
                className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-100 uppercase tracking-wider text-xs"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Đăng nhập ngay
              </button>
            </motion.div>

            {/* Teacher Column */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="geometric-card !p-8 flex flex-col items-center text-center bg-white border-b-4 border-b-accent"
            >
              <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <h2 className="text-xl font-black text-text-main mb-3 uppercase tracking-tight">Dành cho Giáo viên</h2>
              <p className="text-sm text-text-sub mb-8 leading-relaxed">Quản lý lớp học, theo dõi tiến độ của học sinh và đánh giá hiệu quả của lộ trình học tập.</p>
              
              {!showGuestLogin ? (
                <button
                  onClick={() => setShowGuestLogin(true)}
                  className="w-full bg-white border-2 border-accent/20 hover:border-accent text-accent font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 uppercase tracking-wider text-xs"
                >
                  <Users className="w-4 h-4" />
                  Truy cập nhanh (Demo)
                </button>
              ) : (
                <div className="w-full space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <input 
                    type="password"
                    placeholder="Nhập mã truy cập..."
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
                    className="w-full border-2 border-accent/20 rounded-xl px-4 py-4 focus:border-accent outline-none font-bold text-center text-sm tracking-[0.3em] text-accent bg-orange-50/30"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowGuestLogin(false)}
                      className="flex-1 bg-slate-100 text-text-sub font-bold py-3 rounded-xl uppercase tracking-wider text-[0.65rem]"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleGuestLogin}
                      className="flex-[2] bg-accent text-white font-bold py-3 rounded-xl uppercase tracking-wider text-[0.65rem] shadow-lg shadow-orange-100"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Onboarding for students without class info
  if (user.role === 'student' && !user.className && view !== 'dashboard') {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="geometric-card max-w-md w-full"
        >
          <h2 className="text-xl font-bold text-text-main mb-2">Hoàn tất thông tin</h2>
          <p className="text-text-sub text-sm mb-6">Chào mừng {user.fullName}! Vui lòng cho biết lớp của bạn để bắt đầu.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-text-sub uppercase tracking-wider mb-1 block">Lớp của bạn</label>
              <input 
                type="text" 
                placeholder="Ví dụ: 12A1" 
                className="w-full border border-border-main rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none font-medium"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value;
                    if (val) {
                      await setDoc(doc(db, 'users', user.uid), { ...user, className: val }, { merge: true });
                      setUser({ ...user, className: val });
                    }
                  }
                }}
              />
            </div>
            <button
              onClick={async () => {
                const input = document.querySelector('input') as HTMLInputElement;
                if (input.value) {
                  await setDoc(doc(db, 'users', user.uid), { ...user, className: input.value }, { merge: true });
                  setUser({ ...user, className: input.value });
                }
              }}
              className="w-full bg-primary text-white font-bold py-3 rounded-lg uppercase tracking-wider text-sm"
            >
              Xác nhận
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const stages = [
    { 
      id: 1, 
      title: 'Khởi động', 
      subtitle: 'Củng cố nền tảng HK1',
      desc: 'Tập trung các chủ đề lớp 11 và đầu năm lớp 12. Xây dựng nền móng vững chắc cho các giai đoạn sau.',
      topics: ['Hình học không gian', 'Lượng giác', 'Đạo hàm'],
      color: 'primary',
      benefits: [
        'Lấy lại kiến thức căn bản lớp 11 trọng tâm',
        'Xây dựng tư duy hình học không gian 12',
        'Làm quen với các dạng toán đạo hàm lớp 12',
        'Xác định sớm lỗ hổng kiến thức để bù đắp'
      ]
    },
    { 
      id: 2, 
      title: 'Tăng tốc', 
      subtitle: 'Bứt phá kiến thức mới',
      desc: 'Khắc phục điểm yếu GĐ 1 và học thêm chủ đề Thống kê. Nâng cao kỹ năng giải quyết các bài toán vận dụng.',
      topics: ['Thống kê', 'Hàm số lũy thừa', 'Logarit'],
      color: 'accent',
      benefits: [
        'Bứt phá với các chuyên đề thống kê và hàm số',
        'Nắm vững toàn bộ công thức Logarit và lũy thừa',
        'Ứng dụng Casio vào các bài toán vận dụng cao',
        'Tiết kiệm 40% thời gian ôn tập so với tự học'
      ]
    },
    { 
      id: 3, 
      title: 'Về đích', 
      subtitle: 'Hoàn thiện chương trình',
      desc: 'Hoàn thiện các chủ đề còn lại và Xác suất. Tổng hợp kiến thức toàn diện chuẩn bị cho kỳ thi.',
      topics: ['Xác suất', 'Nguyên hàm', 'Tích phân'],
      color: 'success',
      benefits: [
        'Hoàn thành chương trình lớp 12 đúng tiến độ',
        'Chinh phục các bài toán xác suất thực tế',
        'Nắm chắc kiến thức nguyên hàm, tích phân',
        'Nhận ngay lộ trình chi tiết ôn tập tổng hợp'
      ]
    },
    { 
      id: 4, 
      title: 'Luyện đề', 
      subtitle: 'Tổng ôn & Thực chiến',
      desc: 'Ôn tập toàn diện và rèn luyện kỹ năng giải đề. Làm quen với áp lực phòng thi và tối ưu thời gian.',
      topics: ['Đề minh họa', 'Đề chính thức', 'Mẹo Casio'],
      color: 'text-main',
      benefits: [
        'Rèn luyện kỹ năng làm đề thi chính thức',
        'Tối ưu hóa thời gian làm bài dưới áp lực',
        'Tổng hợp các mẹo giải nhanh và thủ thuật Casio',
        'Rà soát kỹ năng thực chiến cuối cùng'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-bg-main flex">
      {/* Sidebar */}
      <nav className="w-64 bg-card border-r border-border-main p-8 flex flex-col gap-10 hidden lg:flex">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-xl text-text-main tracking-tighter">MATHCONQUER</span>
        </div>
        
        <ul className="flex flex-col gap-3">
          <li 
            onClick={() => setView('home')}
            className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center gap-3 ${view === 'home' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:bg-bg-main'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Tổng quan
          </li>
          
          <li 
            onClick={() => setView('roadmap')}
            className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center gap-3 ${view === 'roadmap' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:bg-bg-main'}`}
          >
            <BookOpen className="w-4 h-4" />
            Lộ trình cá nhân
          </li>

          <li 
            onClick={() => setView('aitutor')}
            className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center gap-3 ${view === 'aitutor' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:bg-bg-main'}`}
          >
            <Bot className="w-4 h-4" />
            Gia sư ảo AI
          </li>

          {user.role === 'teacher' && (
            <li 
              onClick={() => setView('dashboard')}
              className={`px-4 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all flex items-center gap-3 ${view === 'dashboard' ? 'bg-primary text-white shadow-md' : 'text-text-sub hover:bg-bg-main'}`}
            >
              <Users className="w-4 h-4" />
              Bảng điều khiển
            </li>
          )}
        </ul>

        <div className="mt-auto"></div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 px-8 flex items-center justify-between bg-white border-b border-border-main sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-main uppercase">
              {view === 'home' ? 'Hệ thống học tập' : 
               view === 'assessment' ? `Đánh giá Giai đoạn ${selectedStage}` : 
               view === 'roadmap' ? 'Lộ trình cá nhân' : 
               view === 'aitutor' ? 'Gia sư ảo AI' : 'Quản lý học sinh'}
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 border-r border-border-main pr-6">
              <div className="text-right">
                <div className="font-bold text-sm text-text-main">{user.fullName}</div>
                <div className="text-[0.7rem] font-bold text-primary uppercase tracking-tighter">
                  {user.role === 'teacher' ? 'Giáo viên' : `Lớp ${user.className}`}
                </div>
              </div>
              <div className="w-10 h-10 bg-stage-bg rounded-lg flex items-center justify-center font-bold text-primary border border-primary/10">
                {user.fullName.charAt(0)}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-text-sub hover:text-red-600 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-12"
              >
                {/* Hero Section */}
                <section className="relative rounded-3xl overflow-hidden bg-text-main text-white p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-xl space-y-6 relative z-10">
                    <span className="bg-primary/20 text-primary px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border border-primary/30">Học tập thông minh</span>
                    <h2 className="text-4xl font-black tracking-tighter leading-tight">CHINH PHỤC ĐIỂM 10<br />MÔN TOÁN LỚP 12</h2>
                    <p className="text-lg text-white/70 font-medium">Lộ trình ôn tập được thiết kế riêng cho năng lực của bạn, giúp tối ưu hóa thời gian và đạt kết quả cao nhất.</p>
                    <div className="flex gap-4 pt-4">
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-primary">100%</span>
                        <span className="text-[0.6rem] font-bold uppercase opacity-50">Cá nhân hóa</span>
                      </div>
                      <div className="w-px h-10 bg-white/10" />
                      <div className="flex flex-col">
                        <span className="text-2xl font-black text-accent">24/7</span>
                        <span className="text-[0.6rem] font-bold uppercase opacity-50">AI Hỗ trợ</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative hidden md:block">
                    <div className="w-64 h-64 bg-primary/20 rounded-full blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    <GraduationCap className="w-48 h-48 text-white/10 relative z-10 rotate-12" />
                  </div>
                </section>

                {/* Quick Access AI Tutor */}
                {user.role === 'student' && (
                  <section className="bg-white border border-border-main rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm">
                    <div className="w-20 h-20 bg-stage-bg rounded-2xl flex items-center justify-center shrink-0 border border-primary/10">
                      <Bot className="w-10 h-10 text-primary" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="font-black text-text-main uppercase tracking-tight text-lg mb-2">Gia sư ảo AI - Hỗ trợ giải bài tập</h3>
                      <p className="text-sm text-text-sub font-medium leading-relaxed">
                        Chụp ảnh đề bài hoặc nhập câu hỏi, Gia sư AI sẽ hướng dẫn bạn phương pháp giải chi tiết, 
                        nhắc lại kiến thức lý thuyết liên quan để bạn tự tin chinh phục mọi bài toán 12.
                      </p>
                    </div>
                    <button 
                      onClick={() => setView('aitutor')}
                      className="bg-primary text-white font-black py-4 px-8 rounded-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center gap-3 whitespace-nowrap shadow-lg shadow-blue-100"
                    >
                      Bắt đầu chat ngay
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </section>
                )}

                {/* Stages Tabs Section */}
                <section className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-border-main/50">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-text-main tracking-tight uppercase">Lộ trình 4 giai đoạn</h3>
                      <p className="text-text-sub text-sm font-medium italic">Chọn giai đoạn phù hợp để bắt đầu hành trình chinh phục môn Toán.</p>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-border-main shadow-inner">
                      {stages.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedStage(s.id)}
                          className={`px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedStage === s.id 
                            ? 'bg-primary text-white shadow-xl scale-105' 
                            : 'text-text-sub hover:text-primary'
                          }`}
                        >
                          Giai đoạn {s.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedStage}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                    >
                      <div className="lg:col-span-2 space-y-6">
                        <div className="geometric-card !p-10 h-full flex flex-col justify-center border-l-4 border-l-primary">
                          <span className="text-primary font-black text-5xl mb-4 opacity-20">0{selectedStage}</span>
                          <h4 className="text-3xl font-black text-text-main tracking-tighter mb-2 uppercase">{stages[selectedStage-1].title}</h4>
                          <p className="text-xl font-bold text-primary mb-6">{stages[selectedStage-1].subtitle}</p>
                          <p className="text-text-sub text-lg leading-relaxed mb-8">{stages[selectedStage-1].desc}</p>
                          
                          <div className="flex flex-wrap gap-3 mb-10">
                            {stages[selectedStage-1].topics.map(t => (
                              <span key={t} className="px-4 py-2 bg-bg-main border border-border-main rounded-lg text-sm font-bold text-text-main">{t}</span>
                            ))}
                          </div>

                          {user.role === 'student' && (
                            <button
                              onClick={() => setView('assessment')}
                              className="w-fit bg-primary text-white font-bold py-4 px-10 rounded-xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-sm"
                            >
                              Bắt đầu khảo sát Giai đoạn {selectedStage}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="geometric-card !bg-stage-bg border-none h-fit">
                          <h5 className="font-black text-primary mb-6 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                            <Award className="w-4 h-4" />
                            Lợi ích giai đoạn này
                          </h5>
                          <ul className="space-y-5">
                            {stages[selectedStage-1].benefits.map((item, i) => (
                              <li key={i} className="flex items-start gap-3 text-sm text-text-main font-bold leading-snug">
                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                  <CheckCircle className="w-3.5 h-3.5 text-success" />
                                </div>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="geometric-card border-dashed border-2 border-border-main flex flex-col items-center text-center py-10">
                          <Target className="w-10 h-10 text-accent mb-4" />
                          <h5 className="font-black text-text-main mb-2 uppercase text-xs tracking-widest">Mục tiêu của bạn</h5>
                          {latestAssessment ? (
                            <div className="space-y-2">
                              <div className="text-3xl font-black text-primary">{latestAssessment.targetScore}đ</div>
                              <p className="text-[0.65rem] font-bold text-text-sub uppercase tracking-wider bg-white py-1 px-3 rounded-full border border-border-main">
                                {latestAssessment.examType}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-text-sub italic">Hãy thực hiện đánh giá để xác định mục tiêu.</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </section>
              </motion.div>
            )}

            {view === 'assessment' && (
              <AssessmentForm 
                stage={selectedStage} 
                user={user} 
                onComplete={() => setView('roadmap')} 
                onBack={() => setView('home')} 
              />
            )}

            {view === 'roadmap' && (
              <RoadmapView 
                user={user} 
                onBack={() => setView('home')} 
              />
            )}

            {view === 'dashboard' && (
              <TeacherDashboard 
                user={user}
                onBack={() => setView('home')} 
              />
            )}

            {view === 'aitutor' && (
              <AITutor 
                user={user}
                onBack={() => setView('home')}
              />
            )}
          </AnimatePresence>
          
          {/* Footer Implementation */}
          <footer className="mt-20 pt-8 border-t border-border-main no-print">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 opacity-60">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                  <School className="w-5 h-5 text-text-sub" />
                </div>
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-widest text-text-main">Trường THPT Anh Hùng Núp</p>
                  <p className="text-[0.6rem] font-bold text-text-sub">Hệ thống ôn thi tốt nghiệp môn Toán</p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-[0.7rem] font-bold text-text-main">Tác giả: Cô Phan Hồng Huệ & Thầy Trần Sĩ Nguyên</p>
                <div className="flex items-center justify-center md:justify-end gap-2 mt-1">
                  <Mail className="w-3 h-3 text-primary" />
                  <p className="text-[0.65rem] font-bold text-primary underline">honghue1908@gmail.com</p>
                </div>
                <p className="text-[0.6rem] font-medium text-text-sub mt-2">© 2026 MATHCONQUER. Bảo lưu mọi quyền.</p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
