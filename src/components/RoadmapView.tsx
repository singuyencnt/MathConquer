import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { UserProfile, AssessmentData } from '../types';
import Markdown from 'react-markdown';
import { ChevronLeft, Download, Calendar, Target, Clock, Sparkles, Loader2, History, CheckCircle2, FileText, Printer, GraduationCap, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  user: UserProfile;
  onBack: () => void;
}

export default function RoadmapView({ user, onBack }: Props) {
  const [history, setHistory] = useState<AssessmentData[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const roadmapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRoadmapHistory = async () => {
      try {
        const q = query(
          collection(db, 'assessments'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const roadmaps = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as AssessmentData[];
        
        setHistory(roadmaps);
        if (roadmaps.length > 0) {
          setSelectedRoadmap(roadmaps[0]);
        }
      } catch (error) {
        console.error("Error fetching roadmap history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoadmapHistory();
  }, [user.uid]);

  const handleExportPDF = async () => {
    if (!roadmapRef.current || !selectedRoadmap) return;
    
    setExporting(true);
    try {
      const element = roadmapRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Lo-Trinh-Toan-12-GD${selectedRoadmap.stage}-${user.fullName}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
      window.print(); // Fallback to basic print
    } finally {
      setExporting(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử lộ trình của mình? Hành động này không thể hoàn tác.")) return;
    
    setClearing(true);
    try {
      const q = query(collection(db, 'assessments'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setHistory([]);
      setSelectedRoadmap(null);
    } catch (error) {
      console.error("Error clearing history:", error);
    } finally {
      setClearing(false);
    }
  };

  const handleClearAllGlobalHistory = async () => {
    if (!confirm("CHÚ Ý: Bạn đang thực hiện xóa TOÀN BỘ lộ trình của TẤT CẢ người dùng trong hệ thống. Tiếp tục?")) return;
    
    setClearing(true);
    try {
      const snapshot = await getDocs(collection(db, 'assessments'));
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setHistory([]);
      setSelectedRoadmap(null);
      alert("Đã xóa sạch dữ liệu hệ thống.");
    } catch (error) {
      console.error("Error clearing global history:", error);
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-text-sub font-bold uppercase tracking-widest text-xs">Đang tải dữ liệu học tập...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-24 geometric-card max-w-2xl mx-auto">
        <FileText className="w-16 h-16 text-border-main mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-text-main mb-2 tracking-tight">Chưa có lộ trình nào</h2>
        <p className="text-text-sub mb-8 font-medium">Bạn cần thực hiện bài đánh giá năng lực để AI có thể xây dựng lộ trình cá nhân hóa cho bạn.</p>
        <button 
          onClick={onBack} 
          className="bg-primary hover:bg-blue-700 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-xl shadow-blue-100 uppercase tracking-wider text-sm inline-flex items-center gap-3"
        >
          <Target className="w-4 h-4" />
          Bắt đầu đánh giá ngay
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto pb-20">
      {/* Sidebar - History Navigator */}
      <aside className="lg:w-80 space-y-6 no-print">
        <div className="geometric-card">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-text-main uppercase tracking-tighter">Lịch sử lộ trình</h3>
          </div>
          
          <div className="space-y-3">
            {history.map((item, idx) => (
              <button
                key={item.id || idx}
                onClick={() => setSelectedRoadmap(item)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1 group ${
                  selectedRoadmap?.id === item.id 
                  ? 'bg-stage-bg border-primary shadow-sm' 
                  : 'bg-white border-border-main hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[0.6rem] font-black uppercase tracking-widest ${selectedRoadmap?.id === item.id ? 'text-primary' : 'text-text-sub'}`}>
                    Giai đoạn {item.stage}
                  </span>
                  <CheckCircle2 className={`w-3 h-3 ${selectedRoadmap?.id === item.id ? 'text-primary' : 'text-border-main'}`} />
                </div>
                <div className={`font-bold text-sm ${selectedRoadmap?.id === item.id ? 'text-text-main' : 'text-text-sub group-hover:text-text-main'}`}>
                  Lộ trình {new Date(item.createdAt?.toDate?.() || Date.now()).toLocaleDateString('vi-VN')}
                </div>
                <div className="text-[0.65rem] text-text-sub italic">Mục tiêu: {item.targetScore}đ</div>
              </button>
            ))}
          </div>

          <div className="pt-6 mt-6 border-t border-border-main flex flex-col gap-2">
            <button
              onClick={handleClearHistory}
              disabled={clearing}
              className="flex items-center justify-center gap-2 w-full py-2.5 text-[0.65rem] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
            >
              {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              XÓA LỊCH SỬ CỦA TÔI
            </button>
            {user.email === 'minhkhoiklk@gmail.com' && (
              <button
                onClick={handleClearAllGlobalHistory}
                disabled={clearing}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-[0.65rem] font-black text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors border border-red-700"
              >
                {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                XÓA SẠCH DỮ LIỆU CẢ HỆ THỐNG
              </button>
            )}
          </div>
        </div>

        <div className="geometric-card bg-text-main text-white border-none items-center text-center py-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-2xl -mr-10 -mt-10" />
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-50 mb-3">Tài liệu đính kèm</p>
          <p className="font-bold text-sm mb-6 leading-tight">Đừng quên kết hợp lộ trình này với Tài liệu của Giáo viên biên soạn.</p>
          <button className="bg-white/10 hover:bg-white/20 text-white w-full py-2.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wide">
            Xem tài liệu
          </button>
        </div>
      </aside>

      {/* Main Roadmap Display */}
      <div className="flex-1 space-y-8 min-w-0">
        <AnimatePresence mode="wait">
          {selectedRoadmap && (
            <motion.div
              key={selectedRoadmap.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-8"
            >
              {/* Controls Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <button 
                  onClick={onBack}
                  className="flex items-center gap-2 text-text-sub font-bold hover:text-primary transition-colors text-sm uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Quay lại trang chủ
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-text-main rounded-xl text-xs font-bold transition-all border border-border-main shadow-sm"
                  >
                    <Printer className="w-4 h-4 text-text-sub" />
                    In lộ trình
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={exporting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-blue-100 disabled:opacity-70"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Tải PDF
                  </button>
                </div>
              </div>

              {/* PDF Content Root */}
              <div ref={roadmapRef} className="space-y-8 bg-white print:p-8">
                {/* Summary Metadata Card */}
                <div className="geometric-card overflow-hidden">
                  <div className="bg-primary/5 p-8 border-b border-primary/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-primary text-white text-[0.65rem] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                          Giai đoạn {selectedRoadmap.stage}
                        </span>
                        <span className="text-text-sub font-bold text-xs">
                          {new Date(selectedRoadmap.createdAt?.toDate?.() || Date.now()).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <h2 className="text-3xl font-black text-text-main tracking-tighter uppercase">LỘ TRÌNH ÔN THI MATHCONQUER</h2>
                      <p className="text-text-sub text-sm font-medium italic mt-1">Được thiết kế riêng cho: {user.fullName} - Lớp {user.className}</p>
                    </div>
                    <div className="flex -space-x-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-12 h-12 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center text-primary font-black shadow-sm">
                          {i}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border-main">
                    <div className="p-6 text-center">
                      <Target className="w-6 h-6 text-primary mx-auto mb-2 opacity-50" />
                      <div className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest mb-1">Mục tiêu</div>
                      <div className="text-xl font-black text-text-main">{selectedRoadmap.targetScore}đ</div>
                    </div>
                    <div className="p-6 text-center">
                      <Clock className="w-6 h-6 text-indigo-600 mx-auto mb-2 opacity-50" />
                      <div className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest mb-1">Thời gian/ngày</div>
                      <div className="text-xl font-black text-text-main">{selectedRoadmap.dailyTime}p</div>
                    </div>
                    <div className="p-6 text-center">
                      <Calendar className="w-6 h-6 text-purple-600 mx-auto mb-2 opacity-50" />
                      <div className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest mb-1">Thời lượng</div>
                      <div className="text-xl font-black text-text-main">{selectedRoadmap.stage === 4 ? '4 tuần' : '8 tuần'}</div>
                    </div>
                    <div className="p-6 text-center">
                      <Sparkles className="w-6 h-6 text-orange-600 mx-auto mb-2 opacity-50" />
                      <div className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest mb-1">Casio</div>
                      <div className="text-xl font-black text-text-main">{selectedRoadmap.casioSkill}</div>
                    </div>
                  </div>
                </div>

                {/* Main Content Markdown */}
                <div className="geometric-card !p-10 md:!p-16 relative">
                  <div className="absolute top-8 right-8 text-primary/10 select-none">
                    <GraduationCap className="w-32 h-32 rotate-12" />
                  </div>
                  <div className="markdown-body relative z-10">
                    <Markdown>{selectedRoadmap.roadmap || ''}</Markdown>
                  </div>
                </div>

                {/* Scientific Disclaimer & Encouragement */}
                <div className="bg-bg-main border border-border-main rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 no-print">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-border-main shadow-sm flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-10 h-10 text-success" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-text-main uppercase tracking-tight text-lg mb-2">Cam kết thực hiện</h4>
                    <p className="text-sm text-text-sub leading-relaxed font-medium">
                      Lộ trình này được tính toán dựa trên thuật toán AI bám sát dữ liệu năng lực thực tế của bạn. 
                      Việc bám sát lộ trình 90% trở lên sẽ giúp bạn tăng khả năng đạt mục tiêu {selectedRoadmap.targetScore}đ lên đáng kể. 
                      Hãy tin tưởng vào bản thân và người đồng hành MATHCONQUER!
                    </p>
                  </div>
                  <a 
                    href="https://singuyencnt.github.io/On_tap_toan_THPT/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-primary hover:bg-blue-700 text-white font-black py-4 px-8 rounded-xl shadow-xl shadow-blue-100 transition-all uppercase tracking-widest text-sm flex items-center gap-3 shrink-0"
                  >
                    Bắt đầu ôn tập
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
