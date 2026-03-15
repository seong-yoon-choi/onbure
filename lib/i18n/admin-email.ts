import { normalizeLanguage } from "@/lib/i18n";
import { AppLanguage } from "@/lib/i18n/messages";

type AdminSubmissionType = "qna" | "feedback";

const EMAIL_COPY: Record<
    AppLanguage,
    {
        subjectPrefix: string;
        fallbackTitleByType: Record<AdminSubmissionType, string>;
        heading: string;
        introByType: Record<AdminSubmissionType, string>;
        answerLabel: string;
        closing: string;
    }
> = {
    ko: {
        subjectPrefix: "답변이 등록되었습니다",
        fallbackTitleByType: {
            qna: "문의",
            feedback: "피드백",
        },
        heading: "안녕하세요. Onbure입니다.",
        introByType: {
            qna: "보내주신 문의에 대한 답변이 등록되었습니다.",
            feedback: "보내주신 피드백에 대한 답변이 등록되었습니다.",
        },
        answerLabel: "답변 내용",
        closing: "항상 Onbure를 이용해 주셔서 감사합니다.",
    },
    ja: {
        subjectPrefix: "回答が登録されました",
        fallbackTitleByType: {
            qna: "お問い合わせ",
            feedback: "フィードバック",
        },
        heading: "こんにちは。Onbureです。",
        introByType: {
            qna: "お問い合わせへの回答が登録されました。",
            feedback: "フィードバックへの回答が登録されました。",
        },
        answerLabel: "回答内容",
        closing: "いつも Onbure をご利用いただきありがとうございます。",
    },
    en: {
        subjectPrefix: "A reply has been posted",
        fallbackTitleByType: {
            qna: "Your inquiry",
            feedback: "Your feedback",
        },
        heading: "Hello from Onbure.",
        introByType: {
            qna: "A reply has been posted to your inquiry.",
            feedback: "A reply has been posted to your feedback.",
        },
        answerLabel: "Reply",
        closing: "Thank you for using Onbure.",
    },
    fr: {
        subjectPrefix: "Une réponse a été enregistrée",
        fallbackTitleByType: {
            qna: "Votre demande",
            feedback: "Votre feedback",
        },
        heading: "Bonjour, ici Onbure.",
        introByType: {
            qna: "Une réponse a été enregistrée pour votre demande.",
            feedback: "Une réponse a été enregistrée pour votre feedback.",
        },
        answerLabel: "Réponse",
        closing: "Merci d'utiliser Onbure.",
    },
    es: {
        subjectPrefix: "Se registró una respuesta",
        fallbackTitleByType: {
            qna: "Tu consulta",
            feedback: "Tu feedback",
        },
        heading: "Hola, somos Onbure.",
        introByType: {
            qna: "Se registró una respuesta a tu consulta.",
            feedback: "Se registró una respuesta a tu feedback.",
        },
        answerLabel: "Respuesta",
        closing: "Gracias por usar Onbure.",
    },
};

function escapeHtml(value: string): string {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function buildAdminAnswerEmail(params: {
    language?: string | null;
    type: AdminSubmissionType;
    title?: string | null;
    answerContent: string;
}) {
    const language = normalizeLanguage(params.language);
    const copy = EMAIL_COPY[language] || EMAIL_COPY.en;
    const title = String(params.title || "").trim() || copy.fallbackTitleByType[params.type];
    const answerContent = String(params.answerContent || "");

    return {
        subject: `[Onbure] ${copy.subjectPrefix}: ${title}`,
        html: `
            <h2>${escapeHtml(copy.heading)}</h2>
            <p>${escapeHtml(copy.introByType[params.type])}</p>
            <hr style="border: 1px solid #eaeaea; margin-top: 20px; margin-bottom: 20px;" />
            <p><strong>${escapeHtml(copy.answerLabel)}:</strong></p>
            <p style="white-space: pre-wrap;">${escapeHtml(answerContent)}</p>
            <hr style="border: 1px solid #eaeaea; margin-top: 20px; margin-bottom: 20px;" />
            <p>${escapeHtml(copy.closing)}</p>
        `,
    };
}
