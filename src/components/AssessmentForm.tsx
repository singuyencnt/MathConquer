import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserProfile, AssessmentData } from '../types';
import { generateRoadmap } from '../services/aiService';
import { ChevronRight, ChevronLeft, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  stage: number;
  user: UserProfile;
  onComplete: () => void;
  onBack: () => void;
}

const TOPICS_BY_STAGE: Record<number, string[]> = {
  1: [
    "Hình học không gian (Lớp 11)",
    "Dãy số- Cấp số cộng- Cấp số nhân (Lớp 11)",
    "Lượng giác (Lớp 11)",
    "Lý thuyết đồ thị (Lớp 11)",
    "Phương trình, bất phương trình (Lớp 11)",
    "Ứng dụng đạo hàm và khảo sát hàm số (Lớp 12)",
    "Vectơ trong không gian (Lớp 12)"
  ],
  2: [
    "Hình học không gian (Lớp 11)",
    "Dãy số- Cấp số cộng- Cấp số nhân (Lớp 11)",
    "Lượng giác (Lớp 11)",
    "Lý thuyết đồ thị (Lớp 11)",
    "Phương trình, bất phương trình (Lớp 11)",
    "Ứng dụng đạo hàm và khảo sát hàm số (Lớp 12)",
    "Vectơ trong không gian (Lớp 12)",
    "Thống kê (Lớp 12)"
  ],
  3: [
    "Hình học không gian (Lớp 11)",
    "Dãy số- Cấp số cộng- Cấp số nhân (Lớp 11)",
    "Lượng giác (Lớp 11)",
    "Lý thuyết đồ thị (Lớp 11)",
    "Phương trình, bất phương trình (Lớp 11)",
    "Ứng dụng đạo hàm và khảo sát hàm số (Lớp 12)",
    "Vectơ trong không gian (Lớp 12)",
    "Thống kê (Lớp 12)",
    "Xác suất (Lớp 10,11,12)"
  ],
  4: [
    "Hình học không gian (Lớp 11)",
    "Dãy số- Cấp số cộng- Cấp số nhân (Lớp 11)",
    "Lượng giác (Lớp 11)",
    "Lý thuyết đồ thị (Lớp 11)",
    "Phương trình, bất phương trình (Lớp 11)",
    "Ứng dụng đạo hàm và khảo sát hàm số (Lớp 12)",
    "Vectơ trong không gian (Lớp 12)",
    "Thống kê (Lớp 12)",
    "Nguyên hàm, tích phân, ứng dụng (Lớp 12)",
    "Phương pháp tọa độ trong không gian (Lớp 12)",
    "Xác suất (Lớp 10,11,12)"
  ]
};

const BARRIERS = [
  "Không hiểu bản chất lý thuyết.",
  "Hiểu bài nhưng không biết cách trình bày/giải.",
  "Hay tính toán sai số, nhầm dấu.",
  "Quên công thức nhanh."
];

const AI_ROLES = [
  "Giải thích lý thuyết đơn giản, dễ hiểu.",
  "Giải bài tập chi tiết khi được yêu cầu.",
  "Hướng dẫn cách giải chứ không đưa ra đáp án ngay.",
  "Cung cấp các dạng bài tập tương tự để luyện tập.",
  "Hướng dẫn các mẹo giải nhanh và bấm máy tính Casio."
];

export default function AssessmentForm({ stage, user, onComplete, onBack }: Props) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<AssessmentData>>({
    userId: user.uid,
    stage,
    scores: {},
    targetScore: 8,
    dailyTime: 60,
    examType: 'Xét tốt nghiệp',
    topicConfidence: {},
    casioSkill: 'Biết cơ bản',
    barriers: [],
    aiRole: AI_ROLES[0],
    createdAt: null
  });

  const [className, setClassName] = useState(user.className || '');

  const handleTopicChange = (topic: string, confidence: string) => {
    setFormData(prev => ({
      ...prev,
      topicConfidence: {
        ...prev.topicConfidence,
        [topic]: confidence
      }
    }));
  };

  const handleBarrierToggle = (barrier: string) => {
    setFormData(prev => ({
      ...prev,
      barriers: prev.barriers?.includes(barrier)
        ? prev.barriers.filter(b => b !== barrier)
        : [...(prev.barriers || []), barrier]
    }));
  };

  const getInitiativeTimestamp = (s: number) => {
    const baseDates: Record<number, { y: number; m: number; d: number }> = {
      1: { y: 2025, m: 10, d: 10 }, // index 10 = November
      2: { y: 2026, m: 0, d: 19 },  // index 0 = January
      3: { y: 2026, m: 2, d: 23 },  // index 2 = March
    };

    if (s >= 4) return serverTimestamp();

    const base = baseDates[s];
    const date = new Date(base.y, base.m, base.d);
    // Add 0-2 random days
    const offset = Math.floor(Math.random() * 3);
    date.setDate(date.getDate() + offset);
    // Randomize time (8 AM - 6 PM)
    date.setHours(8 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));
    
    return Timestamp.fromDate(date);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Update user class if changed
      if (className !== user.className) {
        await updateDoc(doc(db, 'users', user.uid), { className });
      }

      const finalData = {
        ...formData,
        createdAt: getInitiativeTimestamp(stage)
      };

      // Generate AI Roadmap
      const roadmap = await generateRoadmap(finalData);
      finalData.roadmap = roadmap;

      await addDoc(collection(db, 'assessments'), finalData);
      onComplete();
    } catch (error) {
      console.error("Error submitting assessment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto geometric-card !p-0 overflow-hidden">
      {/* Progress Bar */}
      <div className="bg-bg-main px-8 py-4 border-b border-border-main flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-primary">Giai đoạn {stage}</span>
          <span className="text-border-main">|</span>
          <span className="text-sm text-text-sub">Bước {step} / 3</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border-main'}`} />
          ))}
        </div>
      </div>

      <div className="p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-text-main tracking-tight">Thông tin mục tiêu & Thời gian</h2>
                <span className="bg-success text-white px-3 py-1 rounded-full text-[0.75rem] font-bold">Mục tiêu: {formData.targetScore}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider">Mục tiêu điểm số (/10)</label>
                  <input 
                    type="number" 
                    min="0" max="10" step="0.1"
                    value={formData.targetScore}
                    onChange={(e) => setFormData({...formData, targetScore: parseFloat(e.target.value)})}
                    className="w-full border border-border-main rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider">Thời gian học mỗi ngày (phút)</label>
                  <input 
                    type="number" 
                    value={formData.dailyTime}
                    onChange={(e) => setFormData({...formData, dailyTime: parseInt(e.target.value)})}
                    className="w-full border border-border-main rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider">Hình thức xét tuyển</label>
                  <select 
                    value={formData.examType}
                    onChange={(e) => setFormData({...formData, examType: e.target.value as any})}
                    className="w-full border border-border-main rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none text-sm"
                  >
                    <option>Xét tốt nghiệp</option>
                    <option>Xét đại học</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider">
                    {stage === 1 ? 'Điểm Giữa HK1' : stage === 2 ? 'Điểm Cuối HK1' : stage === 3 ? 'Điểm Giữa HK2' : 'Điểm Cuối HK2'}
                  </label>
                  <input 
                    type="number" 
                    placeholder="0.0"
                    step="0.1"
                    min="0" max="10"
                    value={formData.scores?.[stage === 1 ? 'midHK1' : stage === 2 ? 'endHK1' : stage === 3 ? 'midHK2' : 'endHK2'] || ''}
                    onChange={(e) => setFormData({
                      ...formData, 
                      scores: { 
                        ...formData.scores, 
                        [stage === 1 ? 'midHK1' : stage === 2 ? 'endHK1' : stage === 3 ? 'midHK2' : 'endHK2']: parseFloat(e.target.value) 
                      }
                    })}
                    className="w-full border border-border-main rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-sub uppercase tracking-wider">Thời lượng lộ trình (tuần)</label>
                  <select 
                    value={formData.durationWeeks || (stage === 4 ? 4 : 8)}
                    onChange={(e) => setFormData({...formData, durationWeeks: parseInt(e.target.value)})}
                    className="w-full border border-border-main rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none text-sm font-bold text-primary"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(w => ( w <= (stage === 4 ? 4 : 8) && (
                      <option key={w} value={w}>{w} tuần</option>
                    )))}
                  </select>
                  <p className="text-[0.6rem] text-text-sub italic">Bạn có thể lập lộ trình ngắn hạn (ví dụ 4 tuần) rồi quay lại đánh giá tiếp.</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-xl font-bold text-text-main tracking-tight">Đánh giá năng lực theo chuyên đề</h2>
              <p className="text-sm text-text-sub italic">Hãy trung thực với bản thân để AI có thể hỗ trợ em tốt nhất.</p>
              
              <div className="overflow-x-auto border border-border-main rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-main border-b border-border-main">
                      <th className="px-4 py-3 text-left font-bold text-text-sub uppercase text-[0.7rem]">Chuyên đề trọng tâm</th>
                      <th className="px-4 py-3 text-center font-bold text-primary uppercase text-[0.7rem]">Rất tự tin</th>
                      <th className="px-4 py-3 text-center font-bold text-accent uppercase text-[0.7rem]">Bình thường</th>
                      <th className="px-4 py-3 text-center font-bold text-red-600 uppercase text-[0.7rem]">Yếu/Mất gốc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main">
                    {TOPICS_BY_STAGE[stage].map((topic) => (
                      <tr key={topic} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-text-main font-medium">{topic}</td>
                        {['Rất tự tin', 'Bình thường', 'Rất yếu/Mất gốc'].map((level) => (
                          <td key={level} className="px-4 py-3 text-center">
                            <input 
                              type="radio" 
                              name={topic}
                              checked={formData.topicConfidence?.[topic] === level}
                              onChange={() => handleTopicChange(topic, level)}
                              className="w-4 h-4 text-primary focus:ring-primary"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <h2 className="text-xl font-bold text-text-main tracking-tight">Phân tích kỹ năng cá nhân</h2>

              <div className="space-y-4">
                <label className="text-xs font-bold text-text-sub uppercase tracking-wider">1. Kỹ năng sử dụng máy tính Casio</label>
                <div className="flex flex-wrap gap-3">
                  {['Thành thạo', 'Biết cơ bản', 'Chưa biết dùng'].map(skill => (
                    <button
                      key={skill}
                      onClick={() => setFormData({...formData, casioSkill: skill})}
                      className={`px-6 py-2 rounded-lg border text-sm font-bold transition-all ${formData.casioSkill === skill ? 'bg-primary border-primary text-white shadow-md' : 'bg-white border-border-main text-text-sub hover:border-primary'}`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-text-sub uppercase tracking-wider">2. Rào cản lớn nhất khi tự học</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {BARRIERS.map(barrier => (
                    <button
                      key={barrier}
                      onClick={() => handleBarrierToggle(barrier)}
                      className={`text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${formData.barriers?.includes(barrier) ? 'bg-stage-bg border-primary text-primary' : 'bg-white border-border-main text-text-sub hover:border-primary'}`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.barriers?.includes(barrier) ? 'bg-primary border-primary text-white' : 'border-border-main'}`}>
                        {formData.barriers?.includes(barrier) && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <span className="text-sm font-medium">{barrier}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-text-sub uppercase tracking-wider">3. Vai trò AI mong muốn</label>
                <div className="space-y-2">
                  {AI_ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => setFormData({...formData, aiRole: role})}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${formData.aiRole === role ? 'bg-stage-bg border-primary text-primary' : 'bg-white border-border-main text-text-sub hover:border-primary'}`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.aiRole === role ? 'bg-primary border-primary text-white' : 'border-border-main'}`}>
                        {formData.aiRole === role && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-sm font-medium">{role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="bg-bg-main px-8 py-6 border-t border-border-main flex items-center justify-between">
        <button
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
          className="flex items-center gap-2 text-text-sub font-bold hover:text-text-main transition-colors text-sm uppercase tracking-wider"
        >
          <ChevronLeft className="w-4 h-4" />
          Quay lại
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-2 bg-text-main text-white px-8 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-all text-sm uppercase tracking-wider"
          >
            Tiếp theo
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-white px-10 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                Hoàn tất
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
