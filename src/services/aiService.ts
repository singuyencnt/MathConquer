import { GoogleGenAI } from "@google/genai";

export async function generateRoadmap(assessmentData: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in the environment.");
    return "Lỗi: Chưa cấu hình API Key cho AI. Vui lòng kiểm tra cài đặt Secrets.";
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
    2. Trình bày: TUYỆT ĐỐI KHÔNG dùng bảng biểu. Trình bày danh sách dọc từ trên xuống dưới.

    YÊU CẦU VỀ NỘI DUNG (Bám sát Tài liệu của giáo viên):
    Bộ tài liệu của giáo viên chia theo các chủ đề trọng tâm. Mỗi chủ đề có: Lý thuyết + 3 dạng câu hỏi (Trắc nghiệm nhiều lựa chọn, Trắc nghiệm Đúng – Sai, Câu hỏi trả lời ngắn) phân theo 3 mức độ (Biết, Hiểu, Vận dụng).

    LẬP LỘ TRÌNH CHI TIẾT THEO TỪNG TUẦN:
    Dựa vào "Phiếu tự đánh giá năng lực" (topicConfidence) ở trên để phân bổ số lượng câu hỏi phù hợp cho từng chủ đề:
    - Nếu "Rất yếu/Mất gốc": Ưu tiên làm nhiều câu hỏi mức BIẾT để lấy lại căn bản.
    - Nếu "Bình thường": Cân bằng giữa BIẾT và HIỂU.
    - Nếu "Rất tự tin": Tập trung vào HIỂU và VẬN DỤNG để tối ưu điểm số.

    Mỗi tuần bao gồm:
    1. Các chủ đề cần ôn tập (Bám sát trọng tâm Giai đoạn ${assessmentData.stage}).
    2. Với mỗi chủ đề, hãy chỉ rõ:
       - Số lượng câu hỏi cần làm cho từng dạng và từng mức độ (Ví dụ: "Làm 10 câu Trắc nghiệm nhiều lựa chọn mức Biết", "5 câu Trắc nghiệm Đúng/Sai mức Hiểu"...).
       - Phân bổ thời lượng (số phút) dựa trên quỹ thời gian ${assessmentData.dailyTime} phút/ngày.
    3. Lời khuyên cụ thể để vượt qua rào cản tự học.

    Giai đoạn trọng tâm:
    - GĐ 1: Củng cố nền tảng HK1 (Lớp 11, Ứng dụng đạo hàm, Vector không gian).
    - GĐ 2: Bứt phá kiến thức mới + Thống kê.
    - GĐ 3: Hoàn thiện chương trình + Xác suất.
    - GĐ 4: Tổng ôn và Luyện đề toàn diện.

    Hãy trả về kết quả bằng Markdown sạch sẽ, trình bày chi tiết số câu hỏi cho từng dạng và mức độ cho từng chủ đề.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text || "Xin lỗi, AI không trả về nội dung. Vui lòng thử lại.";
  } catch (error) {
    console.error("Detailed error generating roadmap:", error);
    if (error instanceof Error) {
      if (error.message.includes("API_KEY_INVALID")) {
        return "Lỗi: API Key không hợp lệ. Vui lòng kiểm tra lại trong phần Secrets.";
      }
      return `Xin lỗi, đã có lỗi xảy ra khi kết nối với AI: ${error.message}`;
    }
    return "Xin lỗi, đã có lỗi xảy ra khi tạo lộ trình. Vui lòng thử lại sau.";
  }
}
