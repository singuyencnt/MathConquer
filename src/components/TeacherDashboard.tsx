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

      const FEELINGS = ['Tốt', 'Bình thường', 'Cần cố gắng'] as const;
      const LOG_TEMPLATES = [
        "Hôm nay em đã ôn tập xong phần lý thuyết và làm được 20 câu trắc nghiệm.",
        "Phần này hơi khó hiểu, em cần xem thêm video bài giảng của cô.",
        "Em đã nắm vững các dạng bài tập cơ bản, chuẩn bị sang phần nâng cao rồi ạ.",
        "Học bài này xong em thấy tự tin hơn hẳn, cảm ơn cô nhé!",
        "Em vẫn còn nhầm lẫn công thức phần logarit, lần sau em sẽ cẩn thận hơn.",
        "Hôm nay em dành 2 tiếng để giải đề, kết quả 8.5 làm em rất vui.",
        "Gia sư AI hướng dẫn rất hiểu bài, em đã tự giải được bài toán vận dụng cao.",
        "Em đang cố gắng bám sát lộ trình tuần này cô giao.",
        "Kiến thức về phần Nguyên hàm thật sự rất rộng, nhưng em sẽ không bỏ cuộc.",
        "Em vừa làm xong đề thi thử chuyên đề Oxyz, đạt 9.0 điểm luôn cô ơi!",
        "Cảm ơn cô đã nhắc nhở em về các bẫy trong câu hỏi thực tế, em suýt thì sai.",
        "Em thấy mình tiến bộ rõ rệt ở phần bài tập trắc nghiệm trả lời ngắn.",
        "Học nhóm hôm nay rất vui, chúng em đã giải được nhiều câu khó.",
        "Đã hoàn thành mục tiêu tuần 2 sớm hơn dự kiến, em sẽ dành thời gian ôn lại.",
        "Em cần luyện thêm về kỹ năng sử dụng máy tính Casio để bấm tích phân nhanh hơn.",
        "Một ngày học tập khá mệt nhưng nhìn lại kết quả em thấy rất xứng đáng.",
        "Em đã hiểu bản chất của đồ thị hàm số sau khi đọc tài liệu cô gửi.",
        "Cố gắng mỗi ngày một ít, em tin thành công đang đến gần.",
        "Hôm nay em đã tự vẽ được sơ đồ tư duy cho chương Hàm số, cực kỳ dễ nhớ.",
        "Em cảm ơn cô đã động viên, nhờ đó em không còn thấy sợ môn Toán nữa.",
        "Bài tập trắc nghiệm đúng/sai thật thú vị, giúp em hiểu rõ bản chất định lý.",
        "Em dành cả buổi tối để luyện Oxyz, cuối cùng cũng đã thông suốt rồi cô ạ.",
        "Gia sư AI gợi ý cách nhìn mới về bài toán khoảng cách, thật sự rất hay.",
        "Hôm nay em làm sai 3 câu nhưng đã hiểu rõ lỗi của mình, sẽ không lặp lại ạ.",
        "Mục tiêu 9 điểm môn Toán đang gần hơn bao giờ hết, em sẽ cố gắng hết sức!",
        "Em thích nhất là phần tài liệu tóm tắt trong ứng dụng, rất cô đọng và dễ hiểu.",
        "Hôm nay em tập trung làm các bài toán thực tế, thấy Toán học thật gần gũi.",
        "Em vừa chinh phục được một dạng bài vận dụng cao mà trước đây em toàn bỏ qua.",
        "Sáng nay em dậy sớm 1 tiếng để ôn tập công thức, thấy hiệu quả bất ngờ luôn.",
        "Càng học em càng thấy Toán 12 có nhiều điều thú vị để khám phá, cảm ơn cô!"
      ];

      const generateRichRoadmap = (stage: number, student: UserProfile, assessment: Partial<AssessmentData>) => {
        const topics = STAGE_TOPICS[stage as 1|2|3].map(idx => TOPICS[idx]);
        const score = assessment.scores?.endHK1 || assessment.scores?.midHK1 || 5.0;
        const target = assessment.targetScore || 8.0;
        const dailyTime = assessment.dailyTime || 60;
        const mainBarrier = assessment.barriers?.[0] || "lo lắng về phần Hình học và Lượng giác";

        let plan = '';
        if (stage === 1) {
          plan = `
### TUẦN 1: Làm chủ Ứng dụng đạo hàm và Khảo sát hàm số (Lớp 12)
Trong tuần này, cô muốn em tập trung biến phần em thấy "Bình thường" thành thế mạnh tuyệt đối nhé.
- **Thứ 2 & 3:** Ôn lại lý thuyết về tính đơn điệu, cực trị và giá trị lớn nhất/nhỏ nhất. Làm 15 câu trắc nghiệm nhiều lựa chọn mức độ nhận biết - thông hiểu.
- **Thứ 4 & 5:** Chinh phục bài toán Tiệm cận và Đồ thị hàm số. Đặc biệt chú ý cách đọc bảng biến thiên để không bị lừa nhé.
- **Thứ 6 & 7:** Rèn luyện 10 câu trắc nghiệm Đúng/Sai về sự tương giao của đồ thị. Chủ nhật dành 30 phút hệ thống kiến thức bằng sơ đồ tư duy.

### TUẦN 2: Củng cố Hình học không gian và Lượng giác 11
Đừng để kiến thức cũ làm rào cản, cô sẽ giúp em lấy lại gốc phần này nhanh thôi:
- **Thứ 2 & 3:** Công thức lượng giác và phương trình lượng giác cơ bản. Tập trung vào cách sử dụng Casio để kiểm tra nghiệm nhanh.
- **Thứ 4 & 5:** Thể tích khối đa diện (Chóp, Lăng trụ). Vẽ hình thật to và xác định đúng đường cao là chìa khóa nhé em.
- **Thứ 6 & 7:** Các bài toán thực tế về tối ưu hóa liên quan đến hàm số. Làm 5 câu vận dụng cao có sự hỗ trợ của Gia sư AI.

### TUẦN 3: Tăng tốc Chuyên đề Mũ - Logarit
Đây là phần lấy điểm, hãy thật cẩn thận với các điều kiện xác định:
- **Thứ 2 & 3:** Biến đổi biểu thức lũy thừa, logarit. Học thuộc nằm lòng các tính chất cơ bản.
- **Thứ 4 & 5:** Giải phương trình và bất phương trình mũ/logarit. Luyện kỹ năng loại trừ phương án sai.
- **Thứ 6 & 7:** Bài tập về lãi suất ngân hàng và tăng trưởng dân số. Đây là dạng bài thực tế rất hay gặp trong đề thi.

### TUẦN 4: Tổng ôn và Rèn luyện kỹ năng thực chiến
- **Thứ 2 - 4:** Tổng hợp lại toàn bộ công thức của 3 chuyên đề trên. Làm 1 đề thi thử mini 30 câu trong 45 phút.
- **Thứ 5 & 6:** Tập trung xử lý các lỗi sai hay gặp (Silly mistakes). Nghe Gia sư AI phân tích các "bẫy" lý thuyết.
- **Thứ 7 & Chủ nhật:** Giải đề minh họa cấu trúc mới, tập trung vào phần Trả lời ngắn - phần này đòi hỏi em phải tính toán cực kỳ chính xác.`;
        } else if (stage === 2) {
          plan = `
### TUẦN 1: Đột phá Nguyên hàm và Tích phân
Giai đoạn này rất quan trọng, em cần nắm vững bản chất thay vì chỉ bấm máy:
- **Thứ 2 & 3:** Nguyên hàm cơ bản và các quy tắc tính. Làm 20 câu để thành thạo bảng nguyên hàm.
- **Thứ 4 & 5:** Phương pháp đổi biến số và từng phần. Cô khuyên em nên ghi chép lại các dấu hiệu nhận biết từng phương pháp.
- **Thứ 6 & 7:** Tích phân và các ứng dụng tính diện tích hình phẳng. Hãy vẽ hình để dễ hình dung bài toán nhé.

### TUẦN 2: Chinh phục Khối tròn xoay và Tổ hợp xác suất
- **Thứ 2 & 3:** Mặt cầu, khối cầu, hình nón, hình trụ. Nắm vững công thức diện tích xung quanh và thể tích.
- **Thứ 4 & 5:** Ôn lại Hoán vị, Chỉnh hợp, Tổ hợp và Xác suất lớp 11. Đây là phần dễ mất điểm nếu đọc đề không kỹ.
- **Thứ 6 & 7:** Các bài toán phối hợp giữa hình học không gian và thực tế. Luyện 10 câu trắc nghiệm Đúng/Sai.

### TUẦN 3: Làm chủ Số phức
- **Thứ 2 & 3:** Các phép toán số phức, môđun và số phức liên hợp. Sử dụng Casio để xử lý nhanh các biểu thức phức tạp.
- **Thứ 4 & 5:** Biểu diễn hình học của số phức và bài toán tìm tập hợp điểm. Vẽ hình chính xác giúp em giải nhanh hơn nhiều đấy.
- **Thứ 6 & 7:** Phương trình bậc hai với hệ số thực trên tập số phức. Làm 10 câu trắc nghiệm mức độ thông hiểu.

### TUẦN 4: Tăng tốc giải đề và Tối ưu thời gian
- **Thứ 2 - 4:** Ôn tập các chuyên đề đã học trong tháng. Làm đề thi thử tập trung vào phản xạ nhanh.
- **Thứ 5 & 6:** Rèn luyện kỹ năng giải các câu hỏi Vận dụng cao với sự gợi ý của Gia sư AI để học cách tư duy.
- **Thứ 7 & Chủ nhật:** Hoàn thiện sơ đồ tư duy tổng hợp. Cô tin là em sẽ tự tin hơn rất nhiều sau tuần này!`;
        } else {
          plan = `
### TUẦN 1: Phương pháp tọa độ trong không gian (Oxyz)
Đây là phần trọng tâm chiếm nhiều điểm, hãy học thật chắc:
- **Thứ 2 & 3:** Hệ tọa độ, điểm, vectơ trong không gian. Làm 25 câu nhận biết - thông hiểu để lấy tốc độ.
- **Thứ 4 & 5:** Phương trình mặt phẳng và đường thẳng. Chú ý các vị trí tương đối và khoảng cách.
- **Thứ 6 & 7:** Phương trình mặt cầu. Luyện tập 10 câu trắc nghiệm Đúng/Sai để chắc chắn kiến thức lý thuyết.

### TUẦN 2: Dãy số, Giới hạn và Đạo hàm (Lớp 11)
- **Thứ 2 & 3:** Dãy số, Cấp số cộng và Cấp số nhân. Nắm chắc công thức số hạng tổng quát để không bị nhầm lẫn.
- **Thứ 4 & 5:** Giới hạn của dãy số và hàm số. Học cách khử các dạng vô định nhanh bằng cả tự luận và máy tính.
- **Thứ 6 & 7:** Đạo hàm và ý nghĩa. Đặc biệt là phương trình tiếp tuyến - một dạng rất hay có trong đề thi.

### TUẦN 3: Tổng ôn thực chiến - Cấu trúc đề 2025
- **Thứ 2 & 3:** Giải đề tập trung vào phần I (Trắc nghiệm nhiều lựa chọn). Mục tiêu đạt tối đa điểm phần này.
- **Thứ 4 & 5:** Chinh phục phần II (Trắc nghiệm Đúng/Sai). Đây là phần phân hóa học sinh rất cao, hãy đọc kỹ từng ý.
- **Thứ 6 & 7:** Rèn luyện phần III (Trả lời ngắn). Yêu cầu em phải tính toán chính xác tuyệt đối, không được chủ quan nhé.

### TUẦN 4: Về đích - Tự tin tỏa sáng
- **Thứ 2 - 4:** Rà soát lại tất cả những câu sai trong các đề đã làm. Gia sư AI sẽ giúp em phân tích tại sao em lại sai.
- **Thứ 5 & 6:** Làm 2 đề thi thử hoàn chỉnh đúng thời gian quy định (90 phút) để quen với áp lực.
- **Thứ 7 & Chủ nhật:** Nghỉ ngơi nhẹ nhàng, xem lại các lưu ý quan trọng mà cô đã gửi. Em đã sẵn sàng rồi!`;
        }

        return `Chào **${student.fullName}** nhé! Cô giáo rất ấn tượng với điểm số ${score.toFixed(1)} hiện tại của em. Với mục tiêu đạt ${target}/10, cô đã thiết kế riêng cho em lộ trình 4 tuần tập trung vào việc khắc phục các lỗ hổng lý thuyết và giúp em hệ thống lại kiến thức một cách bản chất nhất. Chúng ta sẽ dành ít nhất ${dailyTime} phút mỗi ngày để cùng nhau tiến bộ nhé!

### LỜI KHUYÊN VƯỢT QUA RÀO CẢN
Vì cô thấy em đang ${mainBarrier}, hãy thử áp dụng các mẹo sau:
- **Không học vẹt:** Hãy luôn đặt câu hỏi "Tại sao?" khi gặp một công thức mới.
- **Sử dụng màu sắc:** Dùng bút highlight cho các bước biến đổi quan trọng trong bài toán.
- **Hỏi Gia sư AI ngay:** Khi bí ý tưởng quá 5 phút, hãy nhắn tin hỏi cô hoặc AI để được gợi ý hướng đi, đừng xem đáp án ngay sẽ làm mất tư duy của em đấy.

${plan}

Cô tin vào năng khiếu và sự chịu khó của em. Chỉ cần kiên trì mỗi ngày, mục tiêu ${target}+ sẽ nằm chắc trong tay cô trò mình. Cố gắng lên nhé, cô luôn ở bên cạnh ủng hộ em!`;
      };

      const TEACHER_RESPONSES = [
        "Tốt lắm em ơi, cô khen em vì nỗ lực không ngừng nghỉ, kết quả hôm nay rất xứng đáng!",
        "Cô thấy em đang tiến bộ rõ rệt từng ngày, hãy giữ vững phong độ này nhé, yêu em!",
        "Đừng nản lòng em nhé, phần này hơi khó nhưng cô tin em sẽ sớm vượt qua được thôi. Cố lên nào!",
        "Cô rất tự hào về tinh thần tự giác học tập của em. Cần cô hỗ trợ gì thêm cứ nhắn ngay cho cô nha!",
        "Lời giải của em hôm nay rất sáng tạo và thông minh, cô rất thích cách em tư duy đó.",
        "Cố gắng lên em thân yêu, mục tiêu bứt phá điểm số đang rất gần rồi, cô luôn bên cạnh ủng hộ em hết mình.",
        "Cô rất mừng khi thấy em đã hiểu bản chất vấn đề rồi. Tiếp tục phát huy tinh thần 'học sâu' này nhé!",
        "Chuyên đề này hơi rắc rối chút xíu nhưng em đã xử lý rất tốt rồi đó, giỏi lắm!",
        "Nhật ký hôm nay của em làm cô thấy vui lây luôn, chúc em có một đêm ngon giấc và mai lại chiến đấu tiếp nhé!",
        "Cô tin tài năng và sự kiên trì của em sẽ làm nên chuyện lớn trong kỳ thi tới. Mãi tin em!"
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

        const studentAs = existingAssessments.filter(a => a.userId === studentId);

        for (let stageNum = 1; stageNum <= 3; stageNum++) {
          let stageAs = studentAs.find(a => a.stage === stageNum);
          
          const stageDate = new Date();
          if (stageNum === 1) stageDate.setMonth(stageDate.getMonth() - 5);
          if (stageNum === 2) stageDate.setMonth(stageDate.getMonth() - 3);
          if (stageNum === 3) stageDate.setMonth(stageDate.getMonth() - 1);
          
          const tasks = STAGE_TOPICS[stageNum as 1|2|3].flatMap((topicIdx, i) => [
            { id: `t-${stageNum}-${topicIdx}-1`, content: `Ôn tập lý thuyết: ${TOPICS[topicIdx]}`, completed: true, week: i + 1 },
            { id: `t-${stageNum}-${topicIdx}-2`, content: `Luyện tập bài tập trắc nghiệm Dạng 1 & 2: ${TOPICS[topicIdx]}`, completed: true, week: i + 1 },
            { id: `t-${stageNum}-${topicIdx}-3`, content: `Giải đề tổng hợp chuyên đề: ${TOPICS[topicIdx]}`, completed: Math.random() > 0.1, week: i + 2 }
          ]);

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
                          roadmapText.includes('AI đã xây dựng lộ trình đặc biệt');
            
            const isMessyData = (stageAs.dailyTime && stageAs.dailyTime < 30) || 
                                (String(stageAs.targetScore).length > 4) ||
                                (stageAs.targetScore && stageAs.targetScore % 0.1 !== 0);

            if (isError || isMessyData || !roadmapText.includes('TUẦN 1')) {
              const updateRef = doc(db, 'assessments', stageAs.id!);
              const cleanTargetScore = Math.round((stageAs.targetScore || 8.0) * 10) / 10;
              const cleanDailyTime = (stageAs.dailyTime && stageAs.dailyTime >= 45) ? stageAs.dailyTime : (60 + Math.floor(Math.random() * 60));
              
              const updatedData: Partial<AssessmentData> = {
                targetScore: cleanTargetScore,
                dailyTime: cleanDailyTime,
                tasks: tasks,
                learningLogs: logs,
                roadmap: generateRichRoadmap(stageNum, student, { 
                  ...stageAs, 
                  targetScore: cleanTargetScore, 
                  dailyTime: cleanDailyTime 
                }),
                durationWeeks: 4
              };
              
              batch.update(updateRef, updatedData);
            }
          } else {
            const newDocRef = doc(collection(db, 'assessments'));
            const midScore = Math.round((5 + Math.random() * 3) * 10) / 10;
            const endScore = Math.round((midScore + (Math.random() * 1.5)) * 10) / 10;
            const targetScore = Math.min(10, Math.round((endScore + 1.2) * 2) / 2);
            
            const tempAs: Partial<AssessmentData> = {
              scores: { midHK1: midScore, endHK1: endScore },
              targetScore: targetScore,
              dailyTime: 60 + Math.floor(Math.random() * 60),
              barriers: ['lo lắng về kiến thức lý thuyết và các câu hỏi vận dụng cao']
            };

            const newAs: AssessmentData = {
              userId: studentId,
              stage: stageNum,
              scores: tempAs.scores!,
              targetScore: Math.round(tempAs.targetScore! * 10) / 10,
              dailyTime: tempAs.dailyTime!,
              examType: 'Xét đại học',
              topicConfidence: {},
              casioSkill: 'Cơ bản',
              barriers: tempAs.barriers!,
              aiRole: 'Thân thiện',
              roadmap: generateRichRoadmap(stageNum, student, tempAs),
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
                    <span>Tham gia: {student.createdAt?.toDate ? new Date(student.createdAt.toDate()).toLocaleDateString('vi-VN') : 'N/A'}</span>
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
