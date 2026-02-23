import type { LegalDocSection, SignupConsentRegion } from "@/lib/signup-consent";

export interface LegalSectionContent {
    id: LegalDocSection;
    title: string;
    paragraphs: string[];
}

export interface RegionLegalDocument {
    region: SignupConsentRegion;
    title: string;
    locale: string;
    effectiveDate: string;
    lastUpdated: string;
    sections: LegalSectionContent[];
}

const KR_DOCUMENT: RegionLegalDocument = {
    region: "KR",
    title: "Onbure 대한민국 서비스 약관 및 동의 문서",
    locale: "ko-KR",
    effectiveDate: "2026-02-20",
    lastUpdated: "2026-02-20",
    sections: [
        {
            id: "terms",
            title: "이용약관",
            paragraphs: [
                "본 약관은 Onbure 서비스의 이용 조건, 회원과 회사의 권리·의무 및 책임사항을 규정합니다.",
                "회원은 정확한 정보로 가입하여야 하며 계정 보안 유지 책임은 회원에게 있습니다.",
                "회원은 관련 법령 및 본 약관을 준수해야 하며, 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
                "회사는 서비스 품질 유지를 위해 기능을 추가·변경·중단할 수 있으며, 중요한 변경은 사전 공지합니다.",
                "회원의 위반 행위가 확인될 경우 회사는 경고, 이용 제한 또는 계정 해지 조치를 할 수 있습니다.",
                "회사와 회원 간 분쟁은 대한민국 법령을 기준으로 해석되며, 별도 강행규정이 있는 경우 해당 규정을 우선 적용합니다.",
            ],
        },
        {
            id: "privacy",
            title: "개인정보 처리방침",
            paragraphs: [
                "회사는 회원가입, 인증, 협업 기능 제공, 보안 대응 및 고객지원 목적 범위에서 개인정보를 처리합니다.",
                "수집 항목은 이메일, 사용자명, 비밀번호 해시, 프로필 정보, 서비스 이용기록 및 보안 로그를 포함할 수 있습니다.",
                "회사는 목적 달성에 필요한 최소한의 개인정보만 처리하며, 목적 외 이용은 법적 근거 또는 별도 동의가 있는 경우에만 수행합니다.",
                "회원은 개인정보 열람, 정정, 삭제, 처리정지 요청 등 관련 법령상 권리를 행사할 수 있습니다.",
                "회사는 개인정보의 안전성 확보를 위해 접근통제, 권한관리, 암호화, 로그 관리 및 내부 관리계획을 적용합니다.",
                "보유기간은 법령상 의무 보관기간 또는 서비스 운영 필요기간을 따르며 기간 경과 시 지체 없이 파기합니다.",
            ],
        },
        {
            id: "cookie",
            title: "쿠키 정책",
            paragraphs: [
                "쿠키는 로그인 유지, 사용자 설정 보존, 서비스 품질 개선을 위해 사용됩니다.",
                "필수 쿠키는 인증·보안·기본 동작에 필요하며, 비필수 쿠키는 분석·개인화 목적으로 사용될 수 있습니다.",
                "회원은 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있으나 일부 기능 이용이 제한될 수 있습니다.",
                "쿠키 사용 목적과 범위가 실질적으로 변경되는 경우 회사는 고지 또는 동의 절차를 통해 안내합니다.",
            ],
        },
        {
            id: "marketing",
            title: "개인정보 마케팅 활용 동의",
            paragraphs: [
                "회원이 동의하는 경우 회사는 서비스 개선 및 맞춤형 안내를 위해 개인정보를 마케팅 분석 목적으로 활용할 수 있습니다.",
                "해당 동의는 선택사항이며 미동의 시에도 핵심 서비스 이용에는 제한이 없습니다.",
                "동의 후에도 회원은 프로필 설정에서 언제든지 동의를 철회할 수 있습니다.",
            ],
        },
        {
            id: "ads",
            title: "광고성 정보 수신 동의",
            paragraphs: [
                "회원이 동의하는 경우 회사는 이메일, 알림 등으로 이벤트, 프로모션, 신규 기능 등 광고성 정보를 발송할 수 있습니다.",
                "회원은 수신 동의를 거부하거나 철회할 수 있으며, 철회 이후 광고성 정보는 발송되지 않습니다.",
                "서비스 운영에 필수적인 보안·정책·계정 관련 안내는 광고성 정보와 별도로 발송될 수 있습니다.",
            ],
        },
    ],
};

const CN_DOCUMENT: RegionLegalDocument = {
    region: "CN",
    title: "Onbure 中国地区服务协议与同意文件",
    locale: "zh-CN",
    effectiveDate: "2026-02-20",
    lastUpdated: "2026-02-20",
    sections: [
        {
            id: "terms",
            title: "服务条款",
            paragraphs: [
                "本条款约定 Onbure 平台的使用规则、用户义务、平台责任与争议处理方式。",
                "用户应提供真实、准确、完整的注册信息，并妥善保管账号凭证。",
                "用户不得实施违法违规、侵害他人权益、破坏平台稳定运行的行为。",
                "平台可基于运营需要对功能进行调整、升级或下线，并按规则进行公告。",
                "对违反条款的行为，平台可采取警告、限制功能、暂停或终止账号等措施。",
            ],
        },
        {
            id: "privacy",
            title: "隐私政策",
            paragraphs: [
                "平台仅在提供服务、保障安全、改进体验与履行法定义务所必需范围内处理个人信息。",
                "处理的信息可能包括账号信息、个人资料、协作记录、访问日志与安全审计记录。",
                "平台遵循合法、正当、必要、诚信原则，不超出明确目的处理个人信息。",
                "用户可依法行使访问、更正、删除、撤回同意、账号注销等权利。",
                "平台采取访问控制、权限分级、加密保护、日志留存等措施保护个人信息安全。",
            ],
        },
        {
            id: "cookie",
            title: "Cookie 政策",
            paragraphs: [
                "Cookie 用于维持登录状态、保存偏好设置、分析服务性能与改进用户体验。",
                "必要 Cookie 用于账号安全和基本功能，非必要 Cookie 用于统计和个性化场景。",
                "用户可通过浏览器设置管理 Cookie，但部分功能可能因此受到影响。",
            ],
        },
        {
            id: "marketing",
            title: "个人信息营销使用同意",
            paragraphs: [
                "在用户单独同意的前提下，平台可将相关信息用于营销分析与推荐优化。",
                "该同意属于可选，不同意不影响核心服务功能使用。",
                "用户可在个人资料设置中随时关闭该同意。",
            ],
        },
        {
            id: "ads",
            title: "广告信息接收同意",
            paragraphs: [
                "在用户同意后，平台可发送活动、产品更新及促销相关信息。",
                "用户可随时取消接收，取消后平台不再发送广告性通知。",
                "与账号安全、协议更新相关的必要通知不属于广告信息。",
            ],
        },
    ],
};

const JP_DOCUMENT: RegionLegalDocument = {
    region: "JP",
    title: "Onbure 日本向け利用規約および同意文書",
    locale: "ja-JP",
    effectiveDate: "2026-02-20",
    lastUpdated: "2026-02-20",
    sections: [
        {
            id: "terms",
            title: "利用規約",
            paragraphs: [
                "本規約は、Onbure サービスの利用条件、ユーザーと運営者の権利義務および責任範囲を定めるものです。",
                "ユーザーは正確な登録情報を提供し、アカウント情報を適切に管理する責任を負います。",
                "法令違反、第三者の権利侵害、サービス運営妨害などの行為は禁止されます。",
                "運営者はサービス品質向上のため、機能の追加・変更・停止を行う場合があります。",
                "規約違反が確認された場合、警告、機能制限、利用停止等の措置を行うことがあります。",
            ],
        },
        {
            id: "privacy",
            title: "プライバシーポリシー",
            paragraphs: [
                "運営者は、サービス提供、セキュリティ確保、サポート対応、品質改善の目的で個人情報を取り扱います。",
                "取得情報には、メールアドレス、ユーザー名、プロフィール情報、利用履歴、監査ログ等が含まれます。",
                "個人情報は利用目的の達成に必要な範囲でのみ取り扱い、目的外利用は法令または同意に基づく場合に限定します。",
                "ユーザーは、開示、訂正、削除、利用停止等の法令上の権利を行使できます。",
                "アクセス制御、暗号化、ログ管理など合理的な安全管理措置を継続的に実施します。",
            ],
        },
        {
            id: "cookie",
            title: "Cookie ポリシー",
            paragraphs: [
                "Cookie は、ログイン維持、設定保存、利用状況分析などの目的で使用されます。",
                "必須 Cookie は認証と基本機能のために使用され、任意 Cookie は分析や最適化のために使用されます。",
                "ユーザーはブラウザ設定で Cookie を管理できますが、一部機能に影響が生じる場合があります。",
            ],
        },
        {
            id: "marketing",
            title: "個人情報のマーケティング利用同意",
            paragraphs: [
                "同意したユーザー情報は、サービス改善や提案精度向上のためのマーケティング分析に利用される場合があります。",
                "この同意は任意であり、不同意でも主要機能は利用できます。",
                "同意後もプロフィール設定からいつでも変更・撤回できます。",
            ],
        },
        {
            id: "ads",
            title: "広告性情報の受信同意",
            paragraphs: [
                "同意した場合、キャンペーン、新機能、プロモーション等の情報を配信することがあります。",
                "受信同意はいつでも解除でき、解除後は広告性情報を送信しません。",
                "セキュリティや規約変更など運営上必要な通知は広告性情報に含まれません。",
            ],
        },
    ],
};

const US_DOCUMENT: RegionLegalDocument = {
    region: "US",
    title: "Onbure U.S. Terms and Consent Document",
    locale: "en-US",
    effectiveDate: "2026-02-20",
    lastUpdated: "2026-02-20",
    sections: [
        {
            id: "terms",
            title: "Terms of Service",
            paragraphs: [
                "These Terms govern access to and use of the Onbure platform, including account use, permitted conduct, and platform operations.",
                "You must provide accurate registration details and maintain confidentiality of your account credentials.",
                "You may not use the service for unlawful activity, abuse, unauthorized access, or interference with platform integrity.",
                "We may update, suspend, or discontinue features to maintain service quality and security with reasonable notice.",
                "Violations may result in warnings, feature restrictions, temporary suspension, or account termination.",
            ],
        },
        {
            id: "privacy",
            title: "Privacy Policy",
            paragraphs: [
                "We process personal information to provide the service, secure accounts, support users, and improve platform performance.",
                "Data categories may include account information, profile data, collaboration activity, access logs, and security records.",
                "We limit processing to specified purposes and apply reasonable safeguards based on data sensitivity and operational risk.",
                "Users can request access, correction, deletion, and related rights as applicable by jurisdiction.",
                "Retention periods are based on legal obligations, fraud prevention, dispute handling, and operational necessity.",
            ],
        },
        {
            id: "cookie",
            title: "Cookie Policy",
            paragraphs: [
                "Cookies and similar technologies are used for authentication, session continuity, preferences, analytics, and performance tuning.",
                "Essential cookies support core service functionality; non-essential cookies support analytics and feature optimization.",
                "You may control non-essential cookies through browser settings or product controls where provided.",
            ],
        },
        {
            id: "marketing",
            title: "Marketing Data Use Consent",
            paragraphs: [
                "If you opt in, we may use eligible profile and usage data for marketing analytics and relevance improvement.",
                "This consent is optional and is not required to access core service features.",
                "You can withdraw this preference at any time from your profile settings.",
            ],
        },
        {
            id: "ads",
            title: "Promotional Communications Consent",
            paragraphs: [
                "If you opt in, we may send product updates, events, campaigns, and promotional announcements.",
                "You can opt out at any time, and we will stop sending promotional communications accordingly.",
                "Operational notices related to account security, policy updates, or service incidents are not promotional communications.",
            ],
        },
    ],
};

const EU_DOCUMENT: RegionLegalDocument = {
    region: "EU",
    title: "Onbure EU (GDPR) Terms and Consent Document",
    locale: "en-EU",
    effectiveDate: "2026-02-20",
    lastUpdated: "2026-02-20",
    sections: [
        {
            id: "terms",
            title: "Terms of Service",
            paragraphs: [
                "These Terms define contractual conditions for using Onbure services, including acceptable use and account obligations.",
                "Users must provide accurate account data and must not misuse or disrupt service operations.",
                "Material service or policy changes are communicated through in-product notice or account communication channels.",
            ],
        },
        {
            id: "privacy",
            title: "Privacy Policy (GDPR Baseline)",
            paragraphs: [
                "We process personal data only where we have a valid legal basis, including contract performance, legal obligations, legitimate interests, or consent where required.",
                "We document processing purposes, categories of data, retention, recipients, safeguards, and transfer mechanisms where applicable.",
                "EU users can exercise applicable rights, including access, rectification, erasure, restriction, portability, and objection.",
                "Where required, we perform proportional security controls and maintain incident response procedures.",
            ],
        },
        {
            id: "cookie",
            title: "Cookie Policy (EU Baseline)",
            paragraphs: [
                "Strictly necessary cookies are used for authentication and service security.",
                "Non-essential cookies for analytics, personalization, or tracking require prior user consent.",
                "Users can manage or withdraw consent at any time without affecting mandatory service cookies.",
            ],
        },
        {
            id: "marketing",
            title: "Marketing Data Use Consent",
            paragraphs: [
                "With optional consent, we may use selected data for campaign analysis and communications optimization.",
                "No direct marketing processing is performed on a consent basis unless user consent is active where required.",
                "Users may revoke consent at any time from profile settings.",
            ],
        },
        {
            id: "ads",
            title: "Promotional Communications Consent",
            paragraphs: [
                "Users can opt in to receive promotional messages about product features, events, and offers.",
                "Users can opt out at any time and such preference is applied without undue delay.",
                "Service-critical notices are sent separately from promotional content.",
            ],
        },
    ],
};

const LEGAL_DOCUMENTS: Record<SignupConsentRegion, RegionLegalDocument> = {
    KR: KR_DOCUMENT,
    CN: CN_DOCUMENT,
    JP: JP_DOCUMENT,
    US: US_DOCUMENT,
    EU: EU_DOCUMENT,
};

export function getRegionLegalDocument(regionLike: string): RegionLegalDocument | null {
    const normalized = String(regionLike || "").trim().toUpperCase() as SignupConsentRegion;
    return LEGAL_DOCUMENTS[normalized] || null;
}
