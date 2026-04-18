import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { UserProfile, AssessmentData } from '../types';
import { Search, Users, ChevronRight, BookOpen, Calendar, Target, ChevronLeft, Loader2, Trash2, AlertTriangle, ListChecks, MessageSquare, Smile, Meh, Frown, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  user: UserProfile;
  onBack: () => void;
}

export default function TeacherDashboard({ user, onBack }: Props) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentAssessments, setStudentAssessments] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const querySnapshot = await getDocs(q);
        const studentList = querySnapshot.docs.map(doc => doc.data() as UserProfile);
        setStudents(studentList);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const handleClearAllGlobalHistory = async () => {
    if (!confirm("CẢNH BÁO QUAN TRỌNG: Bạn đang thực hiện xóa TOÀN BỘ lộ trình của TẤT CẢ học sinh trong hệ thống. Hành động này không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?")) return;
    
    setClearing(true);
    try {
      const snapshot = await getDocs(collection(db, 'assessments'));
      const batch = writeBatch(db);
      
      // Firestore batch limit is 500. For simplified demo we loop if more, but here we just process one batch.
      snapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      
      await batch.commit();
      alert("Đã xóa sạch toàn bộ dữ liệu lộ trình trên hệ thống.");
      if (selectedStudent) {
        setStudentAssessments([]);
      }
    } catch (error) {
      console.error("Error clearing global history:", error);
      alert("Có lỗi xảy ra khi xóa dữ liệu. Vui lòng kiểm tra quyền quản trị.");
    } finally {
      setClearing(false);
    }
  };

  const handleViewStudent = async (student: UserProfile) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    try {
      const q = query(
        collection(db, 'assessments'),
        where('userId', '==', student.uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const assessments = querySnapshot.docs.map(doc => doc.data() as AssessmentData);
      setStudentAssessments(assessments);
    } catch (error) {
      console.error("Error fetching student assessments:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const calculateStudentProgress = (assessment: AssessmentData) => {
    if (!assessment.tasks || assessment.tasks.length === 0) return 0;
    const completed = assessment.tasks.filter(t => t.completed).length;
    return Math.round((completed / assessment.tasks.length) * 100);
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (s.className && s.className.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 font-medium">Đang tải danh sách học sinh...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedStudent ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-text-main tracking-tight">Quản lý học sinh</h1>
                <p className="text-sm text-text-sub">Theo dõi lộ trình ôn tập của các em học sinh lớp 12.</p>
              </div>
              <div className="flex items-center gap-3 self-start">
                {user.email === 'minhkhoiklk@gmail.com' && (
                  <button 
                    onClick={handleClearAllGlobalHistory}
                    disabled={clearing}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black transition-colors border border-red-200 uppercase tracking-wider"
                  >
                    {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Xóa sạch dữ liệu hệ thống
                  </button>
                )}
                <button 
                  onClick={onBack}
                  className="flex items-center gap-2 px-4 py-2 bg-bg-main hover:bg-slate-200 text-text-sub rounded-lg text-sm font-bold transition-colors border border-border-main uppercase tracking-wider"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Quay lại
                </button>
              </div>
            </div>

            <div className="geometric-card !p-4 flex items-center gap-3">
              <Search className="w-5 h-5 text-text-sub" />
              <input 
                type="text" 
                placeholder="Tìm kiếm theo tên hoặc lớp..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 outline-none text-text-main text-sm font-medium"
              />
              <div className="bg-stage-bg px-3 py-1 rounded-full text-primary text-[0.65rem] font-bold flex items-center gap-2 uppercase tracking-widest">
                <Users className="w-3 h-3" />
                {filteredStudents.length} học sinh
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <button
                  key={student.uid}
                  onClick={() => handleViewStudent(student)}
                  className="geometric-card hover:border-primary hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-stage-bg rounded-lg flex items-center justify-center text-primary font-bold text-xl">
                      {student.fullName.charAt(0)}
                    </div>
                    <span className="px-2.5 py-1 bg-bg-main text-text-sub text-[0.65rem] font-bold rounded-md border border-border-main uppercase tracking-wider">
                      Lớp {student.className || 'N/A'}
                    </span>
                  </div>
                  <h3 className="font-bold text-text-main group-hover:text-primary transition-colors tracking-tight">{student.fullName}</h3>
                  <p className="text-xs text-text-sub mb-6">{student.email}</p>
                  <div className="flex items-center justify-between text-[0.65rem] font-bold text-text-sub uppercase tracking-widest pt-4 border-t border-border-main">
                    <span>Tham gia: {new Date(student.createdAt?.toDate()).toLocaleDateString('vi-VN')}</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-primary" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedStudent(null)}
                className="p-2 bg-white rounded-lg shadow-sm border border-border-main hover:bg-bg-main transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-text-sub" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-text-main tracking-tight">{selectedStudent.fullName}</h2>
                <p className="text-sm text-text-sub">Lớp {selectedStudent.className || 'N/A'} • {selectedStudent.email}</p>
              </div>
            </div>

            {loadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-text-sub font-medium">Đang tải lộ trình của học sinh...</p>
              </div>
            ) : studentAssessments.length === 0 ? (
              <div className="geometric-card !p-12 text-center">
                <BookOpen className="w-12 h-12 text-border-main mx-auto mb-4" />
                <p className="text-text-sub font-medium">Học sinh này chưa xây dựng lộ trình nào.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {studentAssessments.map((assessment, idx) => (
                  <div key={idx} className="geometric-card !p-0 overflow-hidden">
                    <div className="bg-bg-main px-6 py-4 border-b border-border-main flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-0.5 bg-primary text-white text-[0.65rem] font-bold rounded-full uppercase tracking-widest">
                          Giai đoạn {assessment.stage}
                        </span>
                        <span className="text-text-sub text-xs font-medium">
                          Ngày tạo: {new Date(assessment.createdAt?.toDate()).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[0.65rem] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-1 text-primary">
                          <Target className="w-3 h-3" />
                          Mục tiêu: {assessment.targetScore}
                        </div>
                        <div className="flex items-center gap-1 text-accent">
                          <Calendar className="w-3 h-3" />
                          {assessment.dailyTime}p/ngày
                        </div>
                      </div>
                    </div>
                    <div className="p-8 md:p-10">
                      <div className="space-y-8">
                        {/* Summary & Progress Header */}
                        <div className="bg-slate-50 border border-border-main p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                           <div className="flex items-center gap-4">
                             <div className="w-16 h-16 bg-white border border-border-main rounded-xl flex items-center justify-center text-primary text-2xl font-black shadow-sm">
                                {calculateStudentProgress(assessment)}%
                             </div>
                             <div>
                               <h4 className="text-sm font-black text-text-main uppercase tracking-tight">Tiến độ tổng thể</h4>
                               <p className="text-xs text-text-sub font-medium">Dựa trên danh sách nhiệm vụ AI thiết lập</p>
                             </div>
                           </div>
                           <div className="w-full md:w-64 h-2 bg-white border border-border-main rounded-full overflow-hidden">
                             <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${calculateStudentProgress(assessment)}%` }}
                                className="h-full bg-primary"
                             />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                          <div className="xl:col-span-2 space-y-8">
                            {/* Roadmap Detailed View */}
                            <div className="markdown-body border border-border-main p-8 md:p-12 rounded-2xl bg-white shadow-sm">
                              <Markdown>{assessment.roadmap || ''}</Markdown>
                            </div>

                            {/* Integrated Task List Monitoring */}
                            <div className="bg-slate-50 border border-border-main p-8 rounded-2xl">
                               <div className="flex items-center gap-3 mb-6">
                                 <ListChecks className="w-5 h-5 text-primary" />
                                 <h4 className="font-bold text-text-main uppercase tracking-tight">Chi tiết nhiệm vụ đã giao</h4>
                               </div>
                               <div className="space-y-8">
                                  {Array.from(new Set(assessment.tasks?.map(t => t.week))).sort((a, b) => (a || 0) - (b || 0)).map(week => (
                                    <div key={week} className="space-y-3">
                                      <h5 className="text-[0.65rem] font-black text-text-sub uppercase tracking-widest pl-3 border-l-2 border-primary">Tuần {week}</h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {assessment.tasks?.filter(t => t.week === week).map(task => (
                                          <div key={task.id} className={`p-3 rounded-lg border flex items-start gap-3 ${task.completed ? 'bg-green-50/50 border-green-200' : 'bg-white border-border-main'}`}>
                                            <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${task.completed ? 'bg-success border-success text-white' : 'border-border-main'}`}>
                                              {task.completed && <CheckCircle2 className="w-3 h-3" />}
                                            </div>
                                            <span className={`text-[0.7rem] font-medium leading-tight ${task.completed ? 'text-green-700' : 'text-text-main'}`}>
                                              {task.content}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          </div>

                          <div className="space-y-6">
                            {/* Student Logs for Teacher */}
                            <div className="bg-white p-6 rounded-2xl border border-border-main shadow-sm sticky top-8">
                              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border-main">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                <h4 className="text-[0.7rem] font-black text-text-main uppercase tracking-widest">Nhật ký học tập</h4>
                              </div>
                              
                              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                                {assessment.learningLogs && assessment.learningLogs.length > 0 ? (
                                  assessment.learningLogs.slice().reverse().map((log) => (
                                    <div key={log.id} className="p-4 bg-slate-50 border border-border-main rounded-xl hover:border-primary/20 transition-all">
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          {log.feeling === 'Tốt' ? <Smile className="w-3 h-3 text-success" /> : log.feeling === 'Bình thường' ? <Meh className="w-3 h-3 text-accent" /> : <Frown className="w-3 h-3 text-red-500" />}
                                          <span className="text-[0.55rem] font-bold text-text-sub uppercase">
                                            {new Date(log.date?.toDate?.() || log.date).toLocaleDateString('vi-VN')}
                                          </span>
                                        </div>
                                        <span className={`text-[0.5rem] font-bold px-1.5 py-0.5 rounded-full ${
                                          log.feeling === 'Tốt' ? 'bg-green-100 text-green-700' : log.feeling === 'Bình thường' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                          {log.feeling}
                                        </span>
                                      </div>
                                      <p className="text-[0.75rem] text-text-main font-medium leading-relaxed">{log.content}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-10">
                                    <p className="text-xs text-text-sub italic">Học sinh chưa bắt đầu ghi nhật ký.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
