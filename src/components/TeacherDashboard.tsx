import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, writeBatch, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, AssessmentData, LearningLog } from '../types';
import { Search, Users, ChevronRight, BookOpen, Calendar, Target, ChevronLeft, Loader2, Trash2, AlertTriangle, ListChecks, MessageSquare, Smile, Meh, Frown, CheckCircle2, Send, Quote, Sparkles } from 'lucide-react';
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
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [isReplying, setIsReplying] = useState<Record<string, boolean>>({});

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
      const assessments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as AssessmentData);
      setStudentAssessments(assessments);
    } catch (error) {
      console.error("Error fetching student assessments:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTeacherReply = async (assessmentId: string, logId: string) => {
    const text = replyText[logId];
    if (!text?.trim()) return;

    setIsReplying(prev => ({ ...prev, [logId]: true }));
    try {
      const assessment = studentAssessments.find(a => a.id === assessmentId);
      if (!assessment) return;

      const updatedLogs = assessment.learningLogs?.map(log => {
        if (log.id === logId) {
          let responseDate = new Date();
          // Logic to randomize response date for back-filled logs (Stage 1, 2, 3)
          if (assessment.stage < 4) {
            const logDate = new Date(log.date?.toDate?.() || log.date);
            // Add 1 to 3 days after the student log date
            const daysOffset = 1 + Math.floor(Math.random() * 3);
            const hoursOffset = Math.floor(Math.random() * 12);
            responseDate = new Date(logDate);
            responseDate.setDate(logDate.getDate() + daysOffset);
            responseDate.setHours(8 + hoursOffset, Math.floor(Math.random() * 60));
          }
          return { ...log, teacherResponse: text, teacherResponseDate: responseDate };
        }
        return log;
      }) || [];

      await updateDoc(doc(db, 'assessments', assessmentId), {
        learningLogs: updatedLogs
      });

      setStudentAssessments(prev => prev.map(a => 
        a.id === assessmentId ? { ...a, learningLogs: updatedLogs } : a
      ));
      
      setReplyText(prev => {
        const next = { ...prev };
        delete next[logId];
        return next;
      });
    } catch (error) {
      console.error("Error replying to log:", error);
      alert("Không thể gửi phản hồi. Vui lòng thử lại.");
    } finally {
      setIsReplying(prev => ({ ...prev, [logId]: false }));
    }
  };

  const handleSeedDemoData = async () => {
    if (students.length === 0) {
      alert("Không có học sinh nào để chuẩn hóa dữ liệu.");
      return;
    }

    if (!confirm(`Hệ thống sẽ chuẩn hóa lộ trình cho ${students.length} học sinh (Giai đoạn 1, 2, 3) để làm đẹp dữ liệu báo cáo. Quá trình này có thể mất vài giây. Bạn có chắc chắn?`)) return;
    
    setSeeding(true);
    try {
      const TOPICS = [
        "Ứng dụng đạo hàm để khảo sát hàm số",
        "Hàm số lũy thừa, mũ và logarit",
        "Nguyên hàm và tích phân",
        "Số phức",
        "Thể tích khối đa diện",
        "Khối tròn xoay",
        "Phương pháp tọa độ trong không gian",
        "Lượng giác (Lớp 11)",
        "Tổ hợp và xác suất (Lớp 11)",
        "Dãy số và cấp số (Lớp 11)",
        "Giới hạn và đạo hàm (Lớp 11)"
      ];

      const STAGE_TOPICS = {
        1: [0, 4, 7], // Hàm số, Đa diện, Lượng giác
        2: [1, 5, 8], // Mũ-Log, Tròn xoay, Tổ hợp
        3: [2, 3, 6, 9, 10] // Tích phân, Số phức, Oxyz, Dãy số, Giới hạn
      };

      const FEELINGS = ['Tốt', 'Bình thường', 'Cần cố gắng'] as const;
      const LOG_TEMPLATES = [
        "Hôm nay em đã ôn tập xong phần lý thuyết và làm được 20 câu trắc nghiệm.",
        "Phần này hơi khó hiểu, em cần xem thêm video bài giảng.",
        "Em đã nắm vững các dạng bài tập cơ bản, chuẩn bị sang phần nâng cao.",
        "Học bài này xong em thấy tự tin hơn hẳn.",
        "Em vẫn còn nhầm lẫn công thức, cần luyện tập thêm nhiều.",
        "Hôm nay em dành 2 tiếng để giải đề, kết quả khá ổn.",
        "Gia sư AI hướng dẫn rất hiểu bài, em đã tự giải được bài toán vận dụng cao.",
        "Em đang cố gắng bám sát lộ trình tuần này.",
        "Kiến thức về phần này thật sự rất rộng, nhưng em sẽ không bỏ cuộc.",
        "Em vừa làm xong đề thi thử chuyên đề, đạt 8.5 điểm.",
        "Cảm ơn Gia sư AI đã nhắc nhở em về các bẫy trong câu hỏi thực tế.",
        "Em thấy mình tiến bộ rõ rệt ở phần bài tập trắc nghiệm trả lời ngắn.",
        "Hôm nay em học nhóm và cùng các bạn giải quyết được nhiều câu khó.",
        "Đã hoàn thành mục tiêu tuần 2 sớm hơn dự kiến.",
        "Em cần luyện thêm về kỹ năng sử dụng máy tính Casio cho phần này.",
        "Một ngày học tập khá mệt nhưng cảm thấy rất xứng đáng.",
        "Em đã hiểu bản chất của đồ thị hàm số sau khi đọc tài liệu hướng dẫn.",
        "Cố gắng mỗi ngày một ít, thành công đang đến gần."
      ];

      const generateRichRoadmap = (stage: number, studentName: string) => {
        const stageThemes = {
          1: "Khởi động và Củng cố nền tảng",
          2: "Tăng tốc và Xử lý chuyên đề trọng tâm",
          3: "Bứt phá và Rèn luyện kỹ năng thực chiến"
        };
        const stageGoals = {
          1: "Nắm vững lý thuyết Hàm số và Hình học đa diện cơ bản.",
          2: "Xử lý dứt điểm Mũ, Logarit và các dạng toán tổ hợp xác suất.",
          3: "Làm chủ Nguyên hàm, Tích phân và Hình học Oxyz lớp 12."
        };
        
        const topics = STAGE_TOPICS[stage as 1|2|3].map(idx => TOPICS[idx]);
        
        return `## LỘ TRÌNH CÁ NHÂN HÓA - Giai đoạn ${stage}: ${stageThemes[stage as 1|2|3]}\n\n` +
               `Chào **${studentName}**, dựa trên mục tiêu điểm số và năng lực hiện tại, AI đã xây dựng lộ trình đặc biệt dành riêng cho em.\n\n` +
               `### Mục tiêu trọng tâm:\n${stageGoals[stage as 1|2|3]}\n\n` +
               `### Kế hoạch chi tiết 4 tuần:\n` +
               `* **Tuần 1-2:** Tập trung đào sâu lý thuyết và các dạng bài tập nhận biết - thông hiểu của chuyên đề: ${topics[0]}.\n` +
               `* **Tuần 3:** Thực hành vận dụng cao, xử lý các bài toán thực tế thuộc chuyên đề: ${topics[1]}.\n` +
               `* **Tuần 4:** Tổng ôn tập, rèn kỹ năng giải trắc nghiệm đúng/sai và trả lời ngắn cho cả 3 chuyên đề: ${topics.join(", ")}.\n\n` +
               `*Chúc em ôn tập hiệu quả và giữ vững quyết tâm!*`;
      };

      const TEACHER_RESPONSES = [
        "Tốt lắm, hãy tiếp tục phát huy tinh thần này nhé!",
        "Phần này quan trọng trong đề thi, em cần chú ý kỹ các công thức đạo hàm.",
        "Đừng quá lo lắng, hãy chia nhỏ bài tập ra làm từng phần một.",
        "Thầy thấy em tiến bộ rất nhanh, cố gắng duy trì nhé!",
        "Nếu khó quá hãy nhắn tin hỏi thầy hoặc nhờ Gia sư AI gợi ý thêm nhé.",
        "Rất tuyệt vời, mục tiêu bứt phá điểm số đang rất gần rồi!",
        "Hãy tập trung xử lý dứt điểm chuyên đề này trong tuần này nhé."
      ];

      // Get all current assessments to find what needs fixing/adding
      const allAssessmentsSnapshot = await getDocs(collection(db, 'assessments'));
      const existingAssessments = allAssessmentsSnapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as AssessmentData));

      const batch = writeBatch(db);
      let count = 0;

      for (const student of students) {
        const studentId = student.uid;
        if (!studentId) continue;

        const studentAs = existingAssessments.filter(a => a.userId === studentId);

        for (let stageNum = 1; stageNum <= 3; stageNum++) {
          let stageAs = studentAs.find(a => a.stage === stageNum);
          
          const stageDate = new Date();
          if (stageNum === 1) stageDate.setMonth(stageDate.getMonth() - 5);
          if (stageNum === 2) stageDate.setMonth(stageDate.getMonth() - 3);
          if (stageNum === 3) stageDate.setMonth(stageDate.getMonth() - 1);
          
          // Generate realistic tasks based on stage
          const tasks = STAGE_TOPICS[stageNum as 1|2|3].flatMap((topicIdx, i) => [
            { id: `t-${stageNum}-${topicIdx}-1`, content: `Ôn tập lý thuyết: ${TOPICS[topicIdx]}`, completed: true, week: i + 1 },
            { id: `t-${stageNum}-${topicIdx}-2`, content: `Luyện tập bài tập trắc nghiệm Dạng 1 & 2: ${TOPICS[topicIdx]}`, completed: true, week: i + 1 },
            { id: `t-${stageNum}-${topicIdx}-3`, content: `Giải đề tổng hợp chuyên đề: ${TOPICS[topicIdx]}`, completed: Math.random() > 0.1, week: i + 2 }
          ]);

          // Generate realistic logs
          const logs: LearningLog[] = [];
          const logCount = 2 + Math.floor(Math.random() * 3);
          for (let l = 0; l < logCount; l++) {
            const logDate = new Date(stageDate);
            logDate.setDate(logDate.getDate() + (l * 5) + 2);
            
            const logFeeling = FEELINGS[Math.floor(Math.random() * FEELINGS.length)];
            const hasResponse = Math.random() > 0.4;
            
            const log: LearningLog = {
              id: `log-${stageNum}-${l}-${Date.now()}-${Math.random()}`,
              date: logDate,
              content: LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)],
              feeling: logFeeling
            };

            if (hasResponse) {
              const resDate = new Date(logDate);
              resDate.setDate(resDate.getDate() + 1);
              log.teacherResponse = TEACHER_RESPONSES[Math.floor(Math.random() * TEACHER_RESPONSES.length)];
              log.teacherResponseDate = resDate;
            }
            logs.push(log);
          }

          if (stageAs) {
            // Check if existing roadmap is an error message
            const isError = stageAs.roadmap?.includes('error') || stageAs.roadmap?.includes('Quota') || stageAs.roadmap?.includes('Lộ trình cá nhân hóa Giai đoạn');
            
            // Update existing or "broken" assessment
            const updateRef = doc(db, 'assessments', stageAs.id!);
            batch.update(updateRef, {
              tasks: tasks,
              learningLogs: logs,
              roadmap: isError ? generateRichRoadmap(stageNum, student.fullName) : stageAs.roadmap,
              durationWeeks: 4
            });
          } else {
            // Create missing history
            const newDocRef = doc(collection(db, 'assessments'));
            const newAs: AssessmentData = {
              userId: studentId,
              stage: stageNum,
              scores: {
                midHK1: 5 + Math.random() * 3,
                endHK1: 6 + Math.random() * 3
              },
              targetScore: 8 + Math.random() * 1.5,
              dailyTime: 2,
              examType: 'Xét đại học',
              topicConfidence: {},
              casioSkill: 'Cơ bản',
              barriers: ['Chưa bám sát lộ trình'],
              aiRole: 'Thân thiện',
              roadmap: generateRichRoadmap(stageNum, student.fullName),
              tasks: tasks,
              learningLogs: logs,
              durationWeeks: 4,
              createdAt: stageDate
            };
            batch.set(newDocRef, newAs);
          }
          count++;
        }
      }

      await batch.commit();
      alert(`Thành công! Đã chuẩn hóa và tạo mới ${count} lộ trình cho ${students.length} học sinh.`);
      
      // Refresh students and assessments
      const querySnapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      setStudents(querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    } catch (error: any) {
      console.error("Error seeding data:", error);
      alert(`Có lỗi xảy ra: ${error.message || "Không xác định"}`);
    } finally {
      setSeeding(false);
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSeedDemoData}
                      disabled={seeding}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-black hover:shadow-md transition-all disabled:opacity-50 uppercase tracking-wider"
                    >
                      {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Làm đẹp dữ liệu (Demo)
                    </button>
                    <button 
                      onClick={handleClearAllGlobalHistory}
                      disabled={clearing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-black transition-colors border border-red-200 uppercase tracking-wider"
                    >
                      {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Xóa sạch dữ liệu hệ thống
                    </button>
                  </div>
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

                                      {/* Teacher Response UI */}
                                      {log.teacherResponse ? (
                                        <div className="mt-3 p-3 bg-blue-50 border-l-4 border-primary rounded-r-xl">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Quote className="w-3 h-3 text-primary" />
                                            <span className="text-[0.6rem] font-black text-primary uppercase tracking-widest">Phản hồi của bạn</span>
                                            <span className="text-[0.5rem] text-text-sub font-bold ml-auto">
                                              {log.teacherResponseDate ? new Date(log.teacherResponseDate?.toDate?.() || log.teacherResponseDate).toLocaleDateString('vi-VN') : ''}
                                            </span>
                                          </div>
                                          <p className="text-[0.7rem] text-blue-900 font-medium italic">"{log.teacherResponse}"</p>
                                        </div>
                                      ) : (
                                        <div className="mt-4 pt-3 border-t border-border-main/50 space-y-2">
                                          <textarea 
                                            placeholder="Động viên hoặc nhắc nhở học sinh..."
                                            value={replyText[log.id] || ''}
                                            onChange={(e) => setReplyText(prev => ({ ...prev, [log.id]: e.target.value }))}
                                            className="w-full bg-white border border-border-main rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary outline-none min-h-[60px]"
                                          />
                                          <div className="flex justify-end">
                                            <button 
                                              disabled={!replyText[log.id]?.trim() || isReplying[log.id]}
                                              onClick={() => handleTeacherReply(assessment.id!, log.id)}
                                              className="bg-primary text-white p-1.5 rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 text-[0.65rem] font-bold disabled:opacity-50"
                                            >
                                              {isReplying[log.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                              Gửi phản hồi
                                            </button>
                                          </div>
                                        </div>
                                      )}
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
