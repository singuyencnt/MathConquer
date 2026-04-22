import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, writeBatch, updateDoc, arrayUnion } from 'firebase/firestore';
import { UserProfile, AssessmentData, RoadmapTask, LearningLog } from '../types';
import Markdown from 'react-markdown';
import { ChevronLeft, Download, Calendar, Target, Clock, Sparkles, Loader2, History, CheckCircle2, FileText, Printer, GraduationCap, Trash2, ExternalLink, ListChecks, MessageSquare, Plus, Smile, Meh, Frown, Quote } from 'lucide-react';
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
  const [newLog, setNewLog] = useState('');
  const [logFeeling, setLogFeeling] = useState<'Tốt' | 'Bình thường' | 'Cần cố gắng'>('Bình thường');
  const [isAddingLog, setIsAddingLog] = useState(false);
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

  const handleDeleteRoadmap = async (e: React.MouseEvent, roadmap: AssessmentData) => {
    e.stopPropagation(); // Avoid selecting the roadmap when clicking delete
    if (!roadmap.id) return;
    if (!confirm("Bạn có chắc chắn muốn xóa lộ trình này?")) return;
    
    setClearing(true);
    try {
      await deleteDoc(doc(db, 'assessments', roadmap.id));
      const updatedHistory = history.filter(item => item.id !== roadmap.id);
      setHistory(updatedHistory);
      if (selectedRoadmap?.id === roadmap.id) {
        setSelectedRoadmap(updatedHistory.length > 0 ? updatedHistory[0] : null);
      }
    } catch (error) {
      console.error("Error deleting roadmap:", error);
      alert("Không thể xóa lộ trình. Vui lòng thử lại.");
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

  const handleToggleTask = async (taskId: string) => {
    if (!selectedRoadmap || !selectedRoadmap.id) return;
    
    const updatedTasks = selectedRoadmap.tasks?.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ) || [];

    try {
      await updateDoc(doc(db, 'assessments', selectedRoadmap.id), {
        tasks: updatedTasks
      });
      setSelectedRoadmap({ ...selectedRoadmap, tasks: updatedTasks });
      setHistory(history.map(h => h.id === selectedRoadmap.id ? { ...h, tasks: updatedTasks } : h));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleAddLog = async () => {
    if (!newLog.trim() || !selectedRoadmap || !selectedRoadmap.id) return;
    
    setIsAddingLog(true);
    
    // Logic to select a realistic date based on the stage
    // Alignment with AssessmentForm.tsx milestones:
    // Stage 1 (Nov 10) -> Logs in Dec 2025
    // Stage 2 (Jan 19) -> Logs in Feb 2026
    // Stage 3 (Mar 23) -> Logs in April 2026
    const getLogDate = (stage: number) => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const lastYear = currentYear - 1;
      
      const randomDay = 5 + Math.floor(Math.random() * 20);
      const randomHour = 8 + Math.floor(Math.random() * 14); 
      const randomMin = Math.floor(Math.random() * 60);

      switch (stage) {
        case 1: return new Date(lastYear, 11, randomDay, randomHour, randomMin); // December 2025
        case 2: return new Date(currentYear, 1, randomDay, randomHour, randomMin); // February 2026
        case 3: return new Date(currentYear, 3, randomDay, randomHour, randomMin); // April 2026
        default: return now;
      }
    };

    const logEntry: LearningLog = {
      id: Math.random().toString(36).substr(2, 9),
      date: getLogDate(selectedRoadmap.stage),
      content: newLog,
      feeling: logFeeling
    };

    try {
      await updateDoc(doc(db, 'assessments', selectedRoadmap.id), {
        learningLogs: arrayUnion(logEntry)
      });
      
      const updatedLogs = [...(selectedRoadmap.learningLogs || []), logEntry];
      setSelectedRoadmap({ ...selectedRoadmap, learningLogs: updatedLogs });
      setHistory(history.map(h => h.id === selectedRoadmap.id ? { ...h, learningLogs: updatedLogs } : h));
      setNewLog('');
    } catch (error) {
      console.error("Error adding log:", error);
    } finally {
      setIsAddingLog(false);
    }
  };

  const calculateProgress = () => {
    if (!selectedRoadmap?.tasks || selectedRoadmap.tasks.length === 0) return 0;
    const completed = selectedRoadmap.tasks.filter(t => t.completed).length;
    return Math.round((completed / selectedRoadmap.tasks.length) * 100);
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
              <div key={item.id || idx} className="relative group/item">
                <button
                  onClick={() => setSelectedRoadmap(item)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1 ${
                    selectedRoadmap?.id === item.id 
                    ? 'bg-stage-bg border-primary shadow-sm' 
                    : 'bg-white border-border-main hover:border-primary/50 text-text-sub'
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
                  <div className="text-[0.65rem] italic">Mục tiêu: {item.targetScore}đ</div>
                </button>
                <button
                  onClick={(e) => handleDeleteRoadmap(e, item)}
                  className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-500 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-red-100"
                  title="Xóa lộ trình này"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {user.email === 'minhkhoiklk@gmail.com' && (
            <div className="pt-6 mt-6 border-t border-border-main">
              <button
                onClick={handleClearAllGlobalHistory}
                disabled={clearing}
                className="flex items-center justify-center gap-2 w-full py-2.5 text-[0.65rem] font-black text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors border border-red-700 shadow-sm"
              >
                {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                XÓA SẠCH DỮ LIỆU CẢ HỆ THỐNG
              </button>
            </div>
          )}
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
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-8">
                    <div className="geometric-card !p-10 md:!p-16 relative overflow-hidden">
                      <div className="absolute top-8 right-8 text-primary/10 select-none no-print">
                        <GraduationCap className="w-32 h-32 rotate-12" />
                      </div>
                      <div className="markdown-body relative z-10">
                        <Markdown>{selectedRoadmap.roadmap || ''}</Markdown>
                      </div>
                    </div>

                    {/* Integrated Checklist for Print and View */}
                    <div className="geometric-card !p-8 md:!p-12 bg-slate-50/50">
                      <div className="flex items-center justify-between mb-8 border-b border-border-main pb-4">
                        <div className="flex items-center gap-3">
                          <ListChecks className="w-6 h-6 text-primary" />
                          <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">Danh sách nhiệm vụ & Tiến độ</h3>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="text-2xl font-black text-primary">{calculateProgress()}%</div>
                          <div className="text-[0.6rem] font-bold text-text-sub uppercase tracking-widest">Hoàn thành</div>
                        </div>
                      </div>

                      <div className="space-y-10">
                        {Array.from(new Set(selectedRoadmap.tasks?.map(t => t.week))).sort((a, b) => a - b).map(week => (
                          <div key={week} className="space-y-4">
                            <div className="flex items-center gap-3">
                              <span className="w-1.5 h-6 bg-primary rounded-full" />
                              <h4 className="text-sm font-black text-text-main uppercase tracking-widest">Nhiệm vụ Tuần {week}</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {selectedRoadmap.tasks?.filter(t => t.week === week).map(task => (
                                <div 
                                  key={task.id}
                                  onClick={() => handleToggleTask(task.id)}
                                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3 bg-white ${
                                    task.completed ? 'border-success/30 shadow-sm' : 'border-border-main hover:border-primary/50 shadow-sm'
                                  }`}
                                >
                                  <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                    task.completed ? 'bg-success border-success text-white' : 'border-border-main bg-white'
                                  }`}>
                                    {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </div>
                                  <span className={`text-[0.8rem] font-medium leading-snug ${task.completed ? 'text-text-sub line-through opacity-70' : 'text-text-main'}`}>
                                    {task.content}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Learning Logs Section - Only logic remains above, we display a list here or keep logs outside? Use discretion */}
                  </div>
                </div>

                {/* Education commitment moved here to be inside print area if desired, or keep as is */}
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

                {/* Learning Logs Section - Displayed for print/view below roadmap */}
                <div className="geometric-card no-print mt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-text-main uppercase tracking-tighter">Nhật ký học tập</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-bg-main p-6 rounded-2xl space-y-4">
                      <textarea
                        value={newLog}
                        onChange={(e) => setNewLog(e.target.value)}
                        placeholder="Ghi chú lại những gì bạn đã học hôm nay hoặc những khó khăn gặp phải..."
                        className="w-full bg-white border border-border-main rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary outline-none min-h-[100px]"
                      />
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-main/50 pt-4">
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold text-text-sub uppercase tracking-wider">Cảm nhận:</span>
                          <div className="flex gap-2">
                            {(['Tốt', 'Bình thường', 'Cần cố gắng'] as const).map(f => (
                              <button
                                key={f}
                                onClick={() => setLogFeeling(f)}
                                className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${logFeeling === f ? 'bg-primary border-primary text-white' : 'bg-white border-border-main text-text-sub hover:border-primary'}`}
                              >
                                {f === 'Tốt' ? <Smile className="w-4 h-4" /> : f === 'Bình thường' ? <Meh className="w-4 h-4" /> : <Frown className="w-4 h-4" />}
                                <span className="text-[0.65rem] font-bold">{f}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={handleAddLog}
                          disabled={isAddingLog || !newLog.trim()}
                          className="bg-primary text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {isAddingLog ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Ghi nhật ký
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {selectedRoadmap.learningLogs?.slice().reverse().map((log) => (
                        <div key={log.id} className="p-4 border border-border-main rounded-xl hover:border-primary/30 transition-colors bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {log.feeling === 'Tốt' ? <Smile className="w-4 h-4 text-success" /> : log.feeling === 'Bình thường' ? <Meh className="w-4 h-4 text-accent" /> : <Frown className="w-4 h-4 text-red-500" />}
                              <span className="text-[0.6rem] font-black text-text-sub uppercase tracking-widest">
                                {new Date(log.date?.toDate?.() || log.date).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            <span className={`text-[0.6rem] font-bold px-2 py-0.5 rounded-full ${
                              log.feeling === 'Tốt' ? 'bg-green-50 text-green-600' : log.feeling === 'Bình thường' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {log.feeling}
                            </span>
                          </div>
                          <p className="text-sm text-text-main font-medium leading-relaxed">{log.content}</p>
                          
                          {log.teacherResponse && (
                            <div className="mt-3 p-4 bg-blue-50 border-l-4 border-primary rounded-r-xl">
                              <div className="flex items-center gap-2 mb-1">
                                <Quote className="w-3 h-3 text-primary" />
                                <span className="text-[0.65rem] font-black text-primary uppercase tracking-widest">Phản hồi từ Giáo viên</span>
                              </div>
                              <p className="text-sm text-blue-900 font-bold italic leading-relaxed">
                                "{log.teacherResponse}"
                              </p>
                              <div className="mt-1 text-right">
                                <span className="text-[0.55rem] text-text-sub font-bold uppercase">
                                  {log.teacherResponseDate ? new Date(log.teacherResponseDate?.toDate?.() || log.teacherResponseDate).toLocaleDateString('vi-VN') : ''}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
