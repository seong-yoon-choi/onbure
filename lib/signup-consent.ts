export type SignupConsentRegion = "KR" | "CN" | "JP" | "US" | "EU";
export type LegalDocSection = "terms" | "privacy" | "cookie" | "marketing" | "ads";

export interface SignupCountryOption {
    code: string;
    label: string;
    region: SignupConsentRegion;
}

export interface SignupConsentContent {
    title: string;
    over14Label?: string;
    termsLabel: string;
    privacyLabel: string;
    cookieLabel: string;
    cookieRequired: boolean;
}

export interface MarketingPreferenceContent {
    sectionTitle: string;
    marketingDataLabel: string;
    adsReceiveLabel: string;
}

export const PRIMARY_SIGNUP_COUNTRIES: SignupCountryOption[] = [
    { code: "KR", label: "South Korea", region: "KR" },
    { code: "CN", label: "China", region: "CN" },
    { code: "JP", label: "Japan", region: "JP" },
    { code: "US", label: "United States", region: "US" },
];

// EU member states (27). These countries follow the shared GDPR baseline.
export const EU_SIGNUP_COUNTRIES: SignupCountryOption[] = [
    { code: "AT", label: "Austria", region: "EU" },
    { code: "BE", label: "Belgium", region: "EU" },
    { code: "BG", label: "Bulgaria", region: "EU" },
    { code: "HR", label: "Croatia", region: "EU" },
    { code: "CY", label: "Cyprus", region: "EU" },
    { code: "CZ", label: "Czechia", region: "EU" },
    { code: "DK", label: "Denmark", region: "EU" },
    { code: "EE", label: "Estonia", region: "EU" },
    { code: "FI", label: "Finland", region: "EU" },
    { code: "FR", label: "France", region: "EU" },
    { code: "DE", label: "Germany", region: "EU" },
    { code: "GR", label: "Greece", region: "EU" },
    { code: "HU", label: "Hungary", region: "EU" },
    { code: "IE", label: "Ireland", region: "EU" },
    { code: "IT", label: "Italy", region: "EU" },
    { code: "LV", label: "Latvia", region: "EU" },
    { code: "LT", label: "Lithuania", region: "EU" },
    { code: "LU", label: "Luxembourg", region: "EU" },
    { code: "MT", label: "Malta", region: "EU" },
    { code: "NL", label: "Netherlands", region: "EU" },
    { code: "PL", label: "Poland", region: "EU" },
    { code: "PT", label: "Portugal", region: "EU" },
    { code: "RO", label: "Romania", region: "EU" },
    { code: "SK", label: "Slovakia", region: "EU" },
    { code: "SI", label: "Slovenia", region: "EU" },
    { code: "ES", label: "Spain", region: "EU" },
    { code: "SE", label: "Sweden", region: "EU" },
];

export const ALL_SIGNUP_COUNTRIES: SignupCountryOption[] = [
    ...PRIMARY_SIGNUP_COUNTRIES,
    ...EU_SIGNUP_COUNTRIES,
];

export const ALLOWED_SIGNUP_COUNTRY_CODES = ALL_SIGNUP_COUNTRIES.map((country) => country.code);

const EU_COUNTRY_CODE_SET = new Set(EU_SIGNUP_COUNTRIES.map((country) => country.code));

export function resolveSignupConsentRegion(countryCode: string): SignupConsentRegion {
    const normalized = String(countryCode || "").trim().toUpperCase();
    if (EU_COUNTRY_CODE_SET.has(normalized)) return "EU";
    if (normalized === "KR" || normalized === "CN" || normalized === "JP" || normalized === "US") {
        return normalized;
    }
    return "KR";
}

export function isCookieConsentRequired(region: SignupConsentRegion): boolean {
    return region === "EU";
}

export function getConsentDetailLabel(region: SignupConsentRegion): string {
    if (region === "KR") return "자세히";
    if (region === "JP") return "詳しく見る";
    if (region === "CN") return "详情";
    return "Details";
}

export function buildLegalDocLink(region: SignupConsentRegion, section: LegalDocSection): string {
    return `/legal/${String(region).toLowerCase()}#${section}`;
}

export const SIGNUP_CONSENT_CONTENT: Record<SignupConsentRegion, SignupConsentContent> = {
    KR: {
        title: "대한민국 가입 동의",
        over14Label: "1. 만 14세 이상입니다. (필수)",
        termsLabel: "2. 이용약관에 동의합니다. (필수)",
        privacyLabel: "3. 개인정보 처리방침에 동의합니다. (필수)",
        cookieLabel: "쿠키 정책을 확인했습니다. (선택)",
        cookieRequired: false,
    },
    CN: {
        title: "中国注册同意",
        termsLabel: "我同意《服务条款》。（必选）",
        privacyLabel: "我同意《隐私政策》。（必选）",
        cookieLabel: "我同意将 Cookie 用于分析和个性化。（可选）",
        cookieRequired: false,
    },
    JP: {
        title: "日本向け登録同意",
        termsLabel: "利用規約に同意します。（必須）",
        privacyLabel: "プライバシーポリシーに同意します。（必須）",
        cookieLabel: "分析およびパーソナライズのためのCookie使用に同意します。（任意）",
        cookieRequired: false,
    },
    US: {
        title: "United States signup consent",
        termsLabel: "I agree to the Terms of Service. (Required)",
        privacyLabel: "I agree to the Privacy Policy. (Required)",
        cookieLabel: "I agree to cookie usage for analytics and personalization. (Optional)",
        cookieRequired: false,
    },
    EU: {
        title: "EU (GDPR) signup consent",
        termsLabel: "I agree to the Terms of Service. (Required)",
        privacyLabel: "I agree to the Privacy Policy (GDPR baseline). (Required)",
        cookieLabel: "I agree to cookie usage for analytics and personalization. (Required)",
        cookieRequired: true,
    },
};

export const MARKETING_PREFERENCE_CONTENT: Record<SignupConsentRegion, MarketingPreferenceContent> = {
    KR: {
        sectionTitle: "마케팅/광고 수신 설정",
        marketingDataLabel: "3. 개인정보 마케팅 활용에 동의합니다. (선택)",
        adsReceiveLabel: "4. 광고성 정보 수신에 동의합니다. (선택)",
    },
    CN: {
        sectionTitle: "营销与广告设置",
        marketingDataLabel: "我同意将个人信息用于营销分析。（可选）",
        adsReceiveLabel: "我同意接收广告性信息。（可选）",
    },
    JP: {
        sectionTitle: "マーケティング・広告設定",
        marketingDataLabel: "個人情報のマーケティング利用に同意します。（任意）",
        adsReceiveLabel: "広告性情報の受信に同意します。（任意）",
    },
    US: {
        sectionTitle: "Marketing and ads preferences",
        marketingDataLabel: "I agree to personal data use for marketing analytics. (Optional)",
        adsReceiveLabel: "I agree to receive promotional communications. (Optional)",
    },
    EU: {
        sectionTitle: "Marketing and ads preferences",
        marketingDataLabel: "I agree to personal data use for marketing analytics. (Optional)",
        adsReceiveLabel: "I agree to receive promotional communications. (Optional)",
    },
};
