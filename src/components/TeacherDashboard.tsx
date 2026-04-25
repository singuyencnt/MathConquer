import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, writeBatch, updateDoc, doc } from 'firebase/firestore';
import { UserProfile, AssessmentData, LearningLog } from '../types';
import { Search, Users, ChevronRight, BookOpen, Calendar, Target, ChevronLeft, Loader2, Trash2, ListChecks, MessageSquare, Smile, Meh, Frown, CheckCircle2, Send, Quote, Sparkles } from 'lucide-react';
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
  const [selectedClass, setSelectedClass] = useState<string>('all');
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

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa học sinh ${studentName}? Hành động này sẽ xóa vĩnh viễn tài khoản và toàn bộ lộ trình của học sinh này.`)) return;

    try {
      const batch = writeBatch(db);
      
      // Delete user doc
      batch.delete(doc(db, 'users', studentId));
      
      // Delete all assessments for this user
      const q = query(collection(db, 'assessments'), where('userId', '==', studentId));
      const querySnapshot = await getDocs(q);
      querySnapshot.docs.forEach(d => {
        batch.delete(d.ref);
      });
      
      await batch.commit();
      
      setStudents(prev => prev.filter(s => s.uid !== studentId));
      alert(`Đã xóa học sinh ${studentName} thành công.`);
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("Có lỗi xảy ra khi xóa học sinh.");
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
          if (assessment.stage < 4) {
            const lDateVal = log.date?.toDate?.() || log.date;
            const logDate = new Date(lDateVal);
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

      const ROADMAP_FOCUS_OPTIONS = [
        "Lấy gốc và củng cố căn bản: Tập trung kỹ lý thuyết và các câu dễ (Mục tiêu 6-7 điểm).",
        "Rèn luyện kỹ năng bài tập: Cân bằng giữa lý thuyết và các dạng toán mức độ hiểu, vận dụng (Mục tiêu 8 điểm).",
        "Chinh phục câu hỏi phân hóa: Đi sâu vào các dạng bài khó và cực khó (Mục tiêu 9+).",
        "Tối ưu kỹ năng phòng tránh bẫy: Rèn luyện độ chính xác, tránh sai sót ở các câu dễ và biết cách phân bổ thời gian."
      ];

      const BARRIER_OPTIONS = [
        "Lỗ hổng kiến thức căn bản.",
        "Mất tập trung khi tự học.",
        "Thiếu tài liệu ôn tập chất lượng.",
        "Áp lực tâm lý, sợ sai.",
        "Không biết cách phân bổ thời gian.",
        "Kỹ năng bấm máy Casio còn yếu.",
        "Khó khăn khi giải bài tập Vận dụng cao.",
        "Hay sai sót ở các câu hỏi dễ."
      ];

      const CONFIDENCE_LEVELS = ["Rất tự tin", "Tự tin", "Chưa tự tin"];

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
        "Cố gắng mỗi ngày một ít, thành công đang đến gần.",
        "Hôm nay em đã tự vẽ được sơ đồ tư duy cho chương Hàm số, dễ nhớ hơn hẳn.",
        "Em cảm ơn cô đã động viên, nhờ đó em không còn thấy sợ môn Toán nữa.",
        "Bài tập trắc nghiệm đúng/sai thật thú vị, giúp em hiểu rõ bản chất định lý.",
        "Em dành cả buổi tối để luyện Oxyz, cuối cùng cũng đã thông suốt.",
        "Gia sư AI gợi ý cách nhìn mới về bài toán khoảng cách, thật sự rất hay.",
        "Hôm nay em làm sai 3 câu nhưng đã hiểu rõ nguyên nhân, không tiếc nuối.",
        "Mục tiêu 9 điểm môn Toán đang gần hơn bao giờ hết, cố lên tôi ơi!",
        "Em thích nhất là phần tài liệu tóm tắt trong ứng dụng, rất cô đọng.",
        "Hôm nay em tập trung làm các bài toán thực tế, thấy Toán học thật gần gũi.",
        "Em vừa chinh phục được một dạng bài vận dụng cao mà trước đây em bỏ qua.",
        "Sáng nay em dậy sớm 1 tiếng để ôn tập công thức, thấy hiệu quả bất ngờ.",
        "Càng học em càng thấy Toán 12 có nhiều điều thú vị để khám phá."
      ];

      const generateRichRoadmap = (stage: number, student: UserProfile, assessment: Partial<AssessmentData>) => {
        const duration = assessment.durationWeeks || 4;
        const topics = STAGE_TOPICS[stage as 1|2|3].map(idx => TOPICS[idx]);
        const score = assessment.scores?.endHK1 || assessment.scores?.midHK1 || 5.0;
        const target = assessment.targetScore || 8.0;
        const dailyTime = assessment.dailyTime || 60;
        const mainBarrier = assessment.barriers?.[0] || "lo lắng về phần Hình học và Lượng giác";

        let content = `Chào **${student.fullName}** nhé! Cô giáo rất ấn tượng với điểm số ${score.toFixed(1)} hiện tại của em. Với mục tiêu duy trì và chắc chắn đạt điểm ${target}+ trong kỳ thi sắp tới, cô đã thiết kế lộ trình ${duration} tuần tập trung vào việc khắc phục các lỗ hổng lý thuyết và giúp em hệ thống lại kiến thức một cách bản chất nhất. Chúng ta sẽ dành ${dailyTime} phút mỗi ngày để cùng nhau tiến bộ nhé!\n\n`;

        for (let w = 1; w <= duration; w++) {
          // Xoay vòng các chủ đề nếu số tuần nhiều hơn số chủ đề
          const topic = topics[(w - 1) % topics.length];
          content += `### TUẦN ${w}: ${topic.toUpperCase()}\n`;
          
          if (w === duration) {
            content += `Đây là tuần cuối cùng, cô trò mình sẽ tổng lực ôn tập và luyện đề thực chiến.\n`;
            content += `- **Thứ 2 & 3:** Ôn lại nhanh các công thức trọng tâm của ${topic}. Làm 15 câu trắc nghiệm mức Vận dụng.\n`;
            content += `- **Thứ 4:** Luyện đề thi thử cấu trúc mới. Tập trung kiểm soát thời gian và rèn kỹ năng không sai câu dễ.\n`;
            content += `- **Thứ 5 & 6:** Phân tích kỹ các câu làm sai. Nếu sai do quên công thức, hãy chép lại và dán vào góc học tập nhé.\n`;
            content += `- **Thứ 7:** Tổng duyệt rà soát toàn bộ kiến thức cùng cô và Gia sư AI.\n`;
            content += `- **Chủ nhật:** Thư giãn, giữ tâm lý thoải mái để sẵn sàng bứt phá.\n\n`;
          } else if (w % 2 === 1) {
            content += `Tuần này chúng ta sẽ bám sát lý thuyết và các dạng bài nhận biết - thông hiểu của chuyên đề này.\n`;
            content += `- **Thứ 2 & 3:** Hệ thống lại lý thuyết cốt lõi bằng sơ đồ tư duy. Làm 15 câu trắc nghiệm mức Hiểu và 5 câu Đúng - Sai.\n`;
            content += `- **Thứ 4:** Tập trung vào các ví dụ minh họa và bài toán thực tế cơ bản. Làm 10 câu trắc nghiệm mức Hiểu.\n`;
            content += `- **Thứ 5 & 6:** Chinh phục các câu hỏi mức độ Thông hiểu. Đừng ngần ngại hỏi Gia sư AI để hiểu rõ bản chất.\n`;
            content += `- **Thứ 7:** Làm bài kiểm tra chuyên đề ngắn (15 câu) để đánh giá năng lực.\n`;
            content += `- **Chủ nhật:** Xem lại các ghi chú và nghỉ ngơi một chút nhé.\n\n`;
          } else {
            content += `Tuần này chúng ta sẽ đào sâu vào các dạng bài Vận dụng và rèn luyện kỹ năng giải nhanh.\n`;
            content += `- **Thứ 2 & 3:** Ôn tập các kỹ thuật Casio và mẹo giải nhanh cho ${topic}. Làm 10 câu trắc nghiệm mức Vận dụng.\n`;
            content += `- **Thứ 4:** Tập trung vào các câu hỏi Đúng - Sai và Trả lời ngắn để hạn chế lỗi sai bản chất.\n`;
            content += `- **Thứ 5 & 6:** Chinh phục 5 câu Vận dụng cao. Hãy để Gia sư AI dẫn dắt tư duy thay vì chỉ xem đáp án.\n`;
            content += `- **Thứ 7:** Tổng hợp bài tập tổng hợp tuần (10 câu hỗn hợp).\n`;
            content += `- **Chủ nhật:** Hệ thống lại các lỗi hay mắc phải trong tuần.\n\n`;
          }
        }

        content += `### LỜI KHUYÊN VÀ RÀO CẢN
- **Để hiểu bản chất:** Đừng chỉ nhìn công thức. Hãy tự đặt câu hỏi "Tại sao lại có bước này?". Vẽ sơ đồ tư duy (Mindmap) để kết nối các định nghĩa.
- **Để bớt quên công thức:** Dùng Flashcard hoặc Mindmap. Mỗi khi học xong một dạng, hãy tự vẽ lại sơ đồ các bước giải.
- **Mỗi ngày ${dailyTime} phút:** Hãy tắt thông báo điện thoại, tập trung hoàn toàn. Chất lượng hơn số lượng em nhé!

Cô tin rằng với nền tảng sẵn có, chỉ cần kiên trì theo lộ trình này, mục tiêu ${target}+ hoàn toàn nằm trong tầm tay em. Cố gắng lên nhé!`;

        return content;
      };

      const TEACHER_RESPONSES = [
        "Tốt lắm em ơi, cô khen em vì nỗ lực không ngừng nghỉ, kết quả hôm nay rất xứng đáng!",
        "Cô thấy em đang tiến bộ rõ rệt từng ngày, hãy giữ vững phong độ này nhé!",
        "Đừng nản lòng em nhé, phần này hơi khó nhưng cô tin em sẽ sớm vượt qua được thôi.",
        "Cô rất tự hào về tinh thần tự giác học tập của em. Cần cô hỗ trợ gì thêm cứ nhắn cô nha!",
        "Lời giải của em hôm nay rất sáng tạo và thông minh, cô đánh giá cao điều đó.",
        "Cố gắng lên em, mục tiêu bứt phá điểm số đang rất gần rồi, cô luôn bên cạnh ủng hộ em.",
        "Cô rất mừng khi thấy em đã hiểu bản chất vấn đề. Tiếp tục phát huy tinh thần này nhé!",
        "Chuyên đề này hơi rắc rối chút xíu nhưng em đã xử lý rất tốt rồi đó.",
        "Nhật ký hôm nay của em làm cô thấy vui lây, chúc em học tập thật tốt nhé!",
        "Cô tin tài năng và sự kiên trì của em sẽ làm nên chuyện trong kỳ thi tới."
      ];

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

        // Fix Join Date (CreatedAt) for students between 10/11 and 13/11/2025
        const joinDay = 10 + Math.floor(Math.random() * 4); // 10, 11, 12, 13
        const joinDate = new Date(2025, 10, joinDay, 8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
        batch.update(doc(db, 'users', studentId), { createdAt: joinDate });

        const studentAs = existingAssessments.filter(a => a.userId === studentId);

        for (let stageNum = 1; stageNum <= 3; stageNum++) {
          let stageAs = studentAs.find(a => a.stage === stageNum);
          
          const stageDate = new Date();
          if (stageNum === 1) stageDate.setMonth(stageDate.getMonth() - 5);
          if (stageNum === 2) stageDate.setMonth(stageDate.getMonth() - 3);
          if (stageNum === 3) stageDate.setMonth(stageDate.getMonth() - 1);
          
          const randomWeeks = [4, 6, 8][Math.floor(Math.random() * 3)];
          const tasks = [];
          for (let w = 1; w <= randomWeeks; w++) {
            const topicIdx = STAGE_TOPICS[stageNum as 1|2|3][(w - 1) % STAGE_TOPICS[stageNum as 1|2|3].length];
            tasks.push(
              { id: `t-${stageNum}-${w}-1`, content: `Ôn tập lý thuyết: ${TOPICS[topicIdx]}`, completed: true, week: w },
              { id: `t-${stageNum}-${w}-2`, content: `Luyện tập trắc nghiệm ${TOPICS[topicIdx]}`, completed: true, week: w },
              { id: `t-${stageNum}-${w}-3`, content: `Kiểm tra tổng hợp Tuần ${w}`, completed: Math.random() > 0.2, week: w }
            );
          }

          const logs: LearningLog[] = [];
          const logCount = 2 + Math.floor(Math.random() * 3);
          const shuffledTemplates = [...LOG_TEMPLATES].sort(() => Math.random() - 0.5);
          
          for (let l = 0; l < logCount; l++) {
            const logDate = new Date(stageDate);
            logDate.setDate(logDate.getDate() + (l * 5) + 2);
            
            const logFeeling = FEELINGS[Math.floor(Math.random() * FEELINGS.length)];
            const hasResponse = Math.random() > 0.4;
            
            const log: LearningLog = {
              id: `log-${stageNum}-${l}-${Date.now()}-${Math.random()}`,
              date: logDate,
              content: shuffledTemplates[l % shuffledTemplates.length],
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
            const roadmapText = stageAs.roadmap || '';
            const isError = roadmapText.includes('error') || 
                          roadmapText.includes('Quota') || 
                          roadmapText.includes('Lộ trình cá nhân hóa Giai đoạn') ||
                          roadmapText.includes('Lộ trình bứt phá Giai đoạn') ||
                          roadmapText.includes('dựa trên mục tiêu điểm số và năng lực hiện tại') ||
                          roadmapText.includes('TUẦN 1-2: TĂNG TỐC') || // Nhận diện format cũ (lộ trình ảo 2)
                          roadmapText.includes('LỜI KHUYÊN VƯỢT QUA RÀO CẢN'); // Nhận diện format cũ
            
            const isMessyData = (stageAs.dailyTime && stageAs.dailyTime < 30) || 
                                (String(stageAs.targetScore).length > 4) ||
                                (!stageAs.durationWeeks);

            if (isError || isMessyData) {
              const updateRef = doc(db, 'assessments', stageAs.id!);
              const cleanTargetScore = Math.round((stageAs.targetScore || 8.0) * 2) / 2;
              const cleanDailyTime = (stageAs.dailyTime && stageAs.dailyTime >= 45) ? stageAs.dailyTime : (60 + Math.floor(Math.random() * 60));
              const cleanDuration = stageAs.durationWeeks || randomWeeks;
              
              // New dummy data for missing fields
              const dummyConfidence: Record<string, string> = {};
              STAGE_TOPICS[stageNum as 1|2|3].forEach(idx => {
                dummyConfidence[TOPICS[idx]] = CONFIDENCE_LEVELS[Math.floor(Math.random() * CONFIDENCE_LEVELS.length)];
              });
              const dummyBarriers = [...BARRIER_OPTIONS].sort(() => Math.random() - 0.5).slice(0, 2);
              const dummyFocus = ROADMAP_FOCUS_OPTIONS[Math.floor(Math.random() * ROADMAP_FOCUS_OPTIONS.length)];

              const updatedData: Partial<AssessmentData> = {
                targetScore: cleanTargetScore,
                dailyTime: cleanDailyTime,
                tasks: tasks,
                learningLogs: logs,
                topicConfidence: stageAs.topicConfidence && Object.keys(stageAs.topicConfidence).length > 0 ? stageAs.topicConfidence : dummyConfidence,
                barriers: stageAs.barriers && stageAs.barriers.length > 0 ? stageAs.barriers : dummyBarriers,
                roadmapFocus: stageAs.roadmapFocus || dummyFocus,
                roadmap: generateRichRoadmap(stageNum, student, { 
                  ...stageAs, 
                  targetScore: cleanTargetScore, 
                  dailyTime: cleanDailyTime,
                  durationWeeks: cleanDuration,
                  barriers: stageAs.barriers && stageAs.barriers.length > 0 ? stageAs.barriers : dummyBarriers
                }),
                durationWeeks: cleanDuration
              };
              
              batch.update(updateRef, updatedData);
            }
          } else {
            const newDocRef = doc(collection(db, 'assessments'));
            const midScore = Math.round((5 + Math.random() * 3) * 10) / 10;
            const endScore = Math.round((midScore + (Math.random() * 1.5)) * 10) / 10;
            const targetScore = Math.min(10, Math.round((endScore + 1.2) * 2) / 2);
            
            const dummyConfidence: Record<string, string> = {};
            STAGE_TOPICS[stageNum as 1|2|3].forEach(idx => {
              dummyConfidence[TOPICS[idx]] = CONFIDENCE_LEVELS[Math.floor(Math.random() * CONFIDENCE_LEVELS.length)];
            });
            const dummyBarriers = [...BARRIER_OPTIONS].sort(() => Math.random() - 0.5).slice(0, 2);
            const dummyFocus = ROADMAP_FOCUS_OPTIONS[Math.floor(Math.random() * ROADMAP_FOCUS_OPTIONS.length)];

            const newAs: AssessmentData = {
              userId: studentId,
              stage: stageNum,
              scores: { midHK1: Math.round((5 + Math.random() * 3) * 10) / 10, endHK1: Math.round((6 + Math.random() * 3) * 10) / 10 },
              targetScore: Math.min(10, Math.round((8 + Math.random() * 2) * 2) / 2),
              dailyTime: 60 + Math.floor(Math.random() * 60),
              examType: 'Xét đại học',
              topicConfidence: dummyConfidence,
              casioSkill: ['Thành thạo', 'Biết cơ bản', 'Chưa biết dùng'][Math.floor(Math.random() * 3)],
              barriers: dummyBarriers,
              roadmapFocus: dummyFocus,
              roadmap: generateRichRoadmap(stageNum, student, {
                barriers: dummyBarriers,
                targetScore: 9.0,
                dailyTime: 60,
                durationWeeks: randomWeeks
              }),
              tasks: tasks,
              learningLogs: logs,
              durationWeeks: randomWeeks,
              createdAt: stageDate
            };
            batch.set(newDocRef, newAs);
          }
          count++;
        }
      }

      await batch.commit();
      alert(`Thành công! Đã chuẩn hóa và tạo mới ${count} lộ trình cho ${students.length} học sinh.`);
      
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

  const classes = ['all', ...Array.from(new Set(students.map(s => s.className?.trim().toUpperCase()).filter(Boolean)))];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (s.className && s.className.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesClass = selectedClass === 'all' || s.className?.trim().toUpperCase() === selectedClass;
    return matchesSearch && matchesClass;
  });

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

            <div className="flex flex-col md:flex-row gap-4">
              <div className="geometric-card !p-4 flex items-center gap-3 flex-1">
                <Search className="w-5 h-5 text-text-sub" />
                <input 
                  type="text" 
                  placeholder="Tìm kiếm theo tên hoặc lớp..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 outline-none text-text-main text-sm font-medium"
                />
              </div>

              <div className="geometric-card !p-4 flex items-center gap-3 min-w-[200px]">
                <Users className="w-5 h-5 text-text-sub" />
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="flex-1 outline-none text-text-main text-sm font-bold bg-transparent"
                >
                  <option value="all">Tất cả các lớp</option>
                  {classes.filter(c => c !== 'all').sort().map(className => (
                    <option key={className} value={className}>{className}</option>
                  ))}
                </select>
                <div className="bg-stage-bg px-3 py-1 rounded-full text-primary text-[0.65rem] font-bold flex items-center gap-2 uppercase tracking-widest whitespace-nowrap">
                  {filteredStudents.length} học sinh
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <div
                  key={student.uid}
                  className="geometric-card hover:border-primary hover:shadow-lg transition-all text-left group relative flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-stage-bg rounded-lg flex items-center justify-center text-primary font-bold text-xl">
                      {student.fullName.charAt(0)}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-bg-main text-text-sub text-[0.65rem] font-bold rounded-md border border-border-main uppercase tracking-wider">
                        Lớp {student.className || 'N/A'}
                      </span>
                      {user.email === 'minhkhoiklk@gmail.com' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStudent(student.uid, student.fullName);
                          }}
                          className="p-1 px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-md border border-red-100 transition-all"
                          title="Xóa học sinh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="cursor-pointer flex-1" onClick={() => handleViewStudent(student)}>
                    <h3 className="font-bold text-text-main group-hover:text-primary transition-colors tracking-tight leading-tight">{student.fullName}</h3>
                    <div className="mt-1 flex flex-col gap-1">
                      <p className="text-[0.7rem] text-text-sub font-medium truncate">{student.email}</p>
                      <div className="flex items-center gap-2 text-[0.65rem] font-bold text-primary uppercase tracking-widest mt-1">
                        <Calendar className="w-3 h-3" />
                        Tham gia: {student.createdAt?.toDate ? new Date(student.createdAt.toDate()).toLocaleDateString('vi-VN') : '12/11/2025'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end text-[0.65rem] font-bold text-text-sub uppercase tracking-widest pt-4 border-t border-border-main mt-auto">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-primary" />
                  </div>
                </div>
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
                          Ngày tạo: {assessment.createdAt?.toDate ? new Date(assessment.createdAt.toDate()).toLocaleDateString('vi-VN') : 'N/A'}
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
                        {assessment.roadmapFocus && (
                          <div className="flex items-center gap-1 text-purple-600">
                             <Sparkles className="w-3 h-3" />
                             {assessment.roadmapFocus}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Detailed Analysis for Teacher */}
                    <div className="px-8 md:px-10 py-6 bg-slate-50/50 border-b border-border-main">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Topic confidence */}
                        <div className="space-y-3">
                          <h5 className="text-[0.6rem] font-black text-text-sub uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                            Đánh giá năng lực chuyên đề
                          </h5>
                          <div className="bg-white border border-border-main rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-[0.7rem]">
                              <tbody className="divide-y divide-border-main">
                                {Object.entries(assessment.topicConfidence || {}).length > 0 ? (
                                  Object.entries(assessment.topicConfidence).map(([topic, level]) => (
                                    <tr key={topic}>
                                      <td className="px-3 py-2 font-bold text-text-main">{topic}</td>
                                      <td className="px-3 py-2 text-right">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[0.55rem] uppercase ${
                                          level === 'Rất tự tin' ? 'bg-green-100 text-green-700' :
                                          level === 'Tự tin' ? 'bg-blue-100 text-blue-700' :
                                          'bg-orange-100 text-orange-700'
                                        }`}>
                                          {level}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-3 py-4 text-center text-text-sub italic">Chưa có dữ liệu.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Barriers & Roadmap Focus */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h5 className="text-[0.6rem] font-black text-text-sub uppercase tracking-widest flex items-center gap-2">
                              <Frown className="w-3.5 h-3.5 text-red-500" />
                              Rào cản học sinh gặp phải
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {assessment.barriers && assessment.barriers.length > 0 ? (
                                assessment.barriers.map(b => (
                                  <span key={b} className="px-2 py-1 bg-red-50 text-red-700 text-[0.6rem] font-bold rounded-md border border-red-100">
                                    {b}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs italic text-text-sub">Không có rào cản.</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h5 className="text-[0.6rem] font-black text-text-sub uppercase tracking-widest flex items-center gap-2">
                              <Target className="w-3.5 h-3.5 text-primary" />
                              Trọng tâm lộ trình yêu cầu
                            </h5>
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                              <p className="text-blue-900 font-bold text-[0.7rem] leading-relaxed">
                                {assessment.roadmapFocus || 'Chưa xác định.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 md:p-10">
                      <div className="space-y-8">
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
                            <div className="markdown-body border border-border-main p-8 md:p-12 rounded-2xl bg-white shadow-sm">
                              <Markdown>{assessment.roadmap || ''}</Markdown>
                            </div>

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

                                      {log.teacherResponse ? (
                                        <div className="mt-3 p-3 bg-blue-50 border-l-4 border-primary rounded-r-xl">
                                          <div className="flex items-center gap-2 mb-1">
                                            <Quote className="w-3 h-3 text-primary" />
                                            <span className="text-[0.6rem] font-black text-primary uppercase tracking-widest">Phản hồi của Cô</span>
                                            <span className="text-[0.5rem] text-text-sub font-bold ml-auto">
                                              {log.teacherResponseDate ? new Date(log.teacherResponseDate?.toDate?.() || log.teacherResponseDate).toLocaleDateString('vi-VN') : ''}
                                            </span>
                                          </div>
                                          <p className="text-[0.7rem] text-blue-900 font-medium italic">"{log.teacherResponse}"</p>
                                        </div>
                                      ) : (
                                        <div className="mt-4 pt-3 border-t border-border-main/50 space-y-2">
                                          <textarea 
                                            placeholder="Cô động viên hoặc nhắc nhở em nhé..."
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
                                    <p className="text-xs text-text-sub italic">Em chưa bắt đầu ghi nhật ký.</p>
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
