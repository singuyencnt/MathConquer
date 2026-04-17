export type Role = 'student' | 'teacher';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  className?: string;
  role: Role;
  createdAt: any;
}

export interface RoadmapTask {
  id: string;
  content: string;
  completed: boolean;
  week: number;
}

export interface LearningLog {
  id: string;
  date: any;
  content: string;
  feeling: 'Tốt' | 'Bình thường' | 'Cần cố gắng';
}

export interface AssessmentData {
  id?: string;
  userId: string;
  stage: number;
  scores: {
    midHK1?: number;
    endHK1?: number;
    midHK2?: number;
    endHK2?: number;
  };
  targetScore: number;
  dailyTime: number;
  examType: 'Xét tốt nghiệp' | 'Xét đại học';
  topicConfidence: Record<string, string>;
  casioSkill: string;
  barriers: string[];
  aiRole: string;
  roadmap?: string;
  tasks?: RoadmapTask[];
  learningLogs?: LearningLog[];
  durationWeeks?: number;
  createdAt: any;
}
