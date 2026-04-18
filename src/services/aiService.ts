import { GoogleGenAI } from "@google/genai";

export async function generateRoadmap(assessmentData: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment.");
    return { 
      roadmap: "Lỗi: Chưa cấu hình API Key cho AI. Vui lòng kiểm tra cài đặt Secrets.", 
      tasks: [] 
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Bạn là một người bạn đồng hành thông thái, hỗ trợ ôn thi Toán lớp 12. 
    Hãy xây dựng lộ trình ôn tập cá nhân hóa cho học sinh dựa trên thông tin sau:
    
    - Giai đoạn: ${assessmentData.stage || 1}
    - Thời lượng lộ trình yêu cầu: ${assessmentData.durationWeeks || (assessmentData.stage === 4 ? 4 : 8)} tuần.
    - Mục tiêu điểm số: ${assessmentData.targetScore || 8}/10
    - Thời gian học mỗi ngày: ${assessmentData.dailyTime || 60} phút
    - Điểm số hiện tại (các kỳ thi): ${JSON.stringify(assessmentData.scores || {})}
    - PHIẾU TỰ ĐÁNH GIÁ NĂNG LỰC (Mức độ tự tin theo chuyên đề): ${JSON.stringify(assessmentData.topicConfidence || {})}
    - Rào cản tự học: ${(assessmentData.barriers || []).join(", ") || 'Không có'}

    YÊU CẦU QUAN TRỌNG VỀ XƯNG HÔ VÀ TRÌNH BÀY:
    1. Xưng hô: Sử dụng "mình" và "bạn". Giọng văn thân thiện, khích lệ.
    2. Trình bày roadmap: TUYỆT ĐỐI KHÔNG dùng bảng biểu. Trình bày danh sách dọc từ trên xuống dưới bằng Markdown.

    YÊU CẦU VỀ NỘI DUNG (Bám sát Tài liệu của giáo viên):
    Bộ tài liệu của giáo viên chia theo các chủ đề trọng tâm. Mỗi chủ đề có: Lý thuyết + 3 dạng câu hỏi (Trắc nghiệm nhiều lựa chọn, Trắc nghiệm Đúng – Sai, Câu hỏi trả lời ngắn) phân theo 3 mức độ (Biết, Hiểu, Vận dụng).

    LẬP LỘ TRÌNH CHI TIẾT THEO TỪNG TUẦN:
    Dựa vào "Phiếu tự đánh giá năng lực" (topicConfidence) ở trên để phân bổ số lượng câu hỏi phù hợp cho từng chủ đề.
    
    Đầu ra phải là một đối tượng JSON có cấu trúc như sau:
    {
      "roadmap": "Nội dung lộ trình CỰC KỲ CHI TIẾT bằng Markdown. Bao gồm: Lời chào, Chia nhỏ từng tuần, Phân bổ chi tiết số lượng câu hỏi cho từng chuyên đề (ví dụ: 'Tuần 1: Ôn tập Đạo hàm - Thực hiện 15 câu trắc nghiệm mức Hiểu...'), Lời khuyên vượt qua rào cản, và kết luận khích lệ. Hãy giữ phong cách thân thiện 'mình' - 'bạn'.",
      "tasks": [
        {
          "id": "chuỗi định danh duy nhất (ví dụ: w1_task1)",
          "content": "Nội dung nhiệm vụ cụ thể và ngắn gọn để học sinh đánh dấu (Ví dụ: Làm 10 câu trắc nghiệm chủ đề Tọa độ không gian mức Biết)",
          "week": 1,
          "completed": false
        },
        ... (liệt kê ít nhất 4-6 nhiệm vụ cụ thể cho MỖI TUẦN để học sinh có thể theo dõi tiến độ chi tiết)
      ]
    }

    Hãy đảm bảo trường 'roadmap' chứa đầy đủ thông tin chi tiết và lời khuyên như trước đây, còn trường 'tasks' là các gạch đầu dòng nhiệm vụ để giám sát.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const text = response.text || "";
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", text);
      return { 
        roadmap: text, 
        tasks: [] 
      };
    }
  } catch (error) {
    console.error("Detailed error generating roadmap:", error);
    const errorMessage = error instanceof Error ? error.message : "Đã có lỗi xảy ra";
    return { 
      roadmap: `Lỗi: ${errorMessage}`, 
      tasks: [] 
    };
  }
}
