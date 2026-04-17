export type Role = 'student' | 'teacher';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  className?: string;
  role: Role;
  createdAt: any;
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
  durationWeeks?: number;
  createdAt: any;
}
