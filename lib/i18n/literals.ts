import { AppLanguage } from "@/lib/i18n/messages";

type LiteralMapEntry = Record<AppLanguage, string>;

const LITERAL_MESSAGES: Record<string, LiteralMapEntry> = {
    "Discovery": { ko: "탐색", ja: "ディスカバリー", en: "Discovery", fr: "Découverte", es: "Descubrimiento" },
    "Search Results": { ko: "검색 결과", ja: "検索結果", en: "Search Results", fr: "Résultats de recherche", es: "Resultados de búsqueda" },
    "Search": { ko: "검색", ja: "検索", en: "Search", fr: "Rechercher", es: "Buscar" },
    "Search teams & people...": { ko: "검색", ja: "検索", en: "Search teams & people...", fr: "Rechercher", es: "Buscar" },
    "Teams": { ko: "팀", ja: "チーム", en: "Teams", fr: "Équipes", es: "Equipos" },
    "My Teams": { ko: "팀", ja: "チーム", en: "My Teams", fr: "Équipes", es: "Equipos" },
    "Select Team": { ko: "팀 선택", ja: "チーム選択", en: "Select Team", fr: "Sélectionner une équipe", es: "Seleccionar equipo" },
    "No teams yet.": { ko: "아직 팀이 없습니다.", ja: "まだチームがありません。", en: "No teams yet.", fr: "Aucune équipe pour le moment.", es: "Aún no hay equipos." },
    "People": { ko: "사람", ja: "人", en: "People", fr: "Personnes", es: "Personas" },
    "Profile": { ko: "프로필", ja: "プロフィール", en: "Profile", fr: "Profil", es: "Perfil" },
    "View Profile": { ko: "프로필 보기", ja: "プロフィールを見る", en: "View Profile", fr: "Voir le profil", es: "Ver perfil" },
    "Team Profile": { ko: "팀 프로필 보기", ja: "チームプロフィール", en: "Team Profile", fr: "Profil d'équipe", es: "Perfil del equipo" },
    "No results matched your search.": { ko: "검색 결과가 없습니다.", ja: "検索条件に一致する結果がありません。", en: "No results matched your search.", fr: "Aucun résultat ne correspond à votre recherche.", es: "No hay resultados para tu búsqueda." },
    "No teams matched your search.": { ko: "검색 조건에 맞는 팀이 없습니다.", ja: "検索条件に一致するチームがありません。", en: "No teams matched your search.", fr: "Aucune équipe ne correspond à votre recherche.", es: "No hay equipos que coincidan con tu búsqueda." },
    "No teams found.": { ko: "팀이 없습니다.", ja: "チームが見つかりません。", en: "No teams found.", fr: "Aucune équipe trouvée.", es: "No se encontraron equipos." },
    "No people matched your search.": { ko: "검색 조건에 맞는 사람이 없습니다.", ja: "検索条件に一致する人がいません。", en: "No people matched your search.", fr: "Aucune personne ne correspond à votre recherche.", es: "No hay personas que coincidan con tu búsqueda." },
    "No people found.": { ko: "사람이 없습니다.", ja: "人が見つかりません。", en: "No people found.", fr: "Aucune personne trouvée.", es: "No se encontraron personas." },
    "Already Joined": { ko: "이미 참여함", ja: "参加済み", en: "Already Joined", fr: "Déjà membre", es: "Ya unido" },
    "Requested": { ko: "요청됨", ja: "申請済み", en: "Requested", fr: "Demandé", es: "Solicitado" },
    "Apply to Join": { ko: "참여 신청", ja: "参加申請", en: "Apply to Join", fr: "Postuler", es: "Solicitar unirse" },
    "Applying...": { ko: "신청 중...", ja: "申請中...", en: "Applying...", fr: "Candidature...", es: "Solicitando..." },
    "No skills yet": { ko: "아직 스킬이 없습니다", ja: "まだスキルがありません", en: "No skills yet", fr: "Pas encore de compétences", es: "Aún no hay habilidades" },
    "No bio yet.": { ko: "아직 소개가 없습니다.", ja: "まだ自己紹介がありません。", en: "No bio yet.", fr: "Pas encore de bio.", es: "Aún no hay biografía." },
    "Hours not set": { ko: "시간 미설정", ja: "時間未設定", en: "Hours not set", fr: "Heures non définies", es: "Horas no configuradas" },
    "Loading...": { ko: "로딩 중...", ja: "読み込み中...", en: "Loading...", fr: "Chargement...", es: "Cargando..." },
    "Create Team": { ko: "팀 만들기", ja: "チーム作成", en: "Create Team", fr: "Créer une équipe", es: "Crear equipo" },
    "Cancel": { ko: "취소", ja: "キャンセル", en: "Cancel", fr: "Annuler", es: "Cancelar" },
    "Send": { ko: "보내기", ja: "送信", en: "Send", fr: "Envoyer", es: "Enviar" },
    "Sending...": { ko: "전송 중...", ja: "送信中...", en: "Sending...", fr: "Envoi...", es: "Enviando..." },
    "Create": { ko: "생성", ja: "作成", en: "Create", fr: "Créer", es: "Crear" },
    "Creating...": { ko: "생성 중...", ja: "作成中...", en: "Creating...", fr: "Création...", es: "Creando..." },
    "Next": { ko: "다음", ja: "次へ", en: "Next", fr: "Suivant", es: "Siguiente" },
    "Back": { ko: "뒤로", ja: "戻る", en: "Back", fr: "Retour", es: "Atrás" },
    "Add": { ko: "추가", ja: "追加", en: "Add", fr: "Ajouter", es: "Agregar" },
    "Remove": { ko: "삭제", ja: "削除", en: "Remove", fr: "Supprimer", es: "Eliminar" },
    "Removing...": { ko: "삭제 중...", ja: "削除中...", en: "Removing...", fr: "Suppression...", es: "Eliminando..." },
    "Invite": { ko: "초대", ja: "招待", en: "Invite", fr: "Inviter", es: "Invitar" },
    "Message": { ko: "메시지", ja: "メッセージ", en: "Message", fr: "Message", es: "Mensaje" },
    "Team": { ko: "팀", ja: "チーム", en: "Team", fr: "Équipe", es: "Equipo" },
    "Visibility": { ko: "공개 설정", ja: "公開設定", en: "Visibility", fr: "Visibilité", es: "Visibilidad" },
    "Public": { ko: "공개", ja: "公開", en: "Public", fr: "Public", es: "Público" },
    "Private": { ko: "비공개", ja: "非公開", en: "Private", fr: "Privé", es: "Privado" },
    "Stage": { ko: "단계", ja: "ステージ", en: "Stage", fr: "Étape", es: "Etapa" },
    "Time Zone": { ko: "시간대", ja: "タイムゾーン", en: "Time Zone", fr: "Fuseau horaire", es: "Zona horaria" },
    "Team Language": { ko: "팀 언어", ja: "チーム言語", en: "Team Language", fr: "Langue d'équipe", es: "Idioma del equipo" },
    "Current Members": { ko: "현재 멤버", ja: "現在メンバー", en: "Current Members", fr: "Membres actuels", es: "Miembros actuales" },
    "Max People": { ko: "최대 인원", ja: "最大人数", en: "Max People", fr: "Nombre max", es: "Personas máximas" },
    "Weekly Commitment": { ko: "주간 참여 시간", ja: "週あたりコミット", en: "Weekly Commitment", fr: "Engagement hebdo", es: "Compromiso semanal" },
    "Work Style": { ko: "업무 스타일", ja: "作業スタイル", en: "Work Style", fr: "Style de travail", es: "Estilo de trabajo" },
    "Recruiting Roles": { ko: "모집 역할", ja: "募集ロール", en: "Recruiting Roles", fr: "Rôles recrutés", es: "Roles buscados" },
    "Notices": { ko: "알림", ja: "通知", en: "Notices", fr: "Notifications", es: "Notificaciones" },
    "No notices yet.": { ko: "아직 알림이 없습니다.", ja: "まだ通知がありません。", en: "No notices yet.", fr: "Aucune notification.", es: "Aún no hay notificaciones." },
    "Chat Requests": { ko: "채팅 요청", ja: "チャット申請", en: "Chat Requests", fr: "Demandes de chat", es: "Solicitudes de chat" },
    "Friend Requests": { ko: "친구 요청", ja: "フレンド申請", en: "Friend Requests", fr: "Demandes d'ami", es: "Solicitudes de amistad" },
    "Team Invites": { ko: "팀 초대", ja: "チーム招待", en: "Team Invites", fr: "Invitations d'équipe", es: "Invitaciones de equipo" },
    "Applications": { ko: "신청", ja: "申請", en: "Applications", fr: "Candidatures", es: "Solicitudes" },
    "File Shares": { ko: "파일 공유", ja: "ファイル共有", en: "File Shares", fr: "Partages de fichiers", es: "Compartir archivos" },
    "Records": { ko: "기록", ja: "記録", en: "Records", fr: "Historique", es: "Registros" },
    "Chat Request": { ko: "채팅 요청", ja: "チャット申請", en: "Chat Request", fr: "Demande de chat", es: "Solicitud de chat" },
    "Friend Request": { ko: "친구 요청", ja: "フレンド申請", en: "Friend Request", fr: "Demande d'ami", es: "Solicitud de amistad" },
    "Team Invite": { ko: "팀 초대", ja: "チーム招待", en: "Team Invite", fr: "Invitation d'équipe", es: "Invitación de equipo" },
    "File Share": { ko: "파일 공유", ja: "ファイル共有", en: "File Share", fr: "Partage de fichier", es: "Compartir archivo" },
    "Record": { ko: "기록", ja: "記録", en: "Record", fr: "Historique", es: "Registro" },
    "Application": { ko: "신청", ja: "申請", en: "Application", fr: "Candidature", es: "Solicitud" },
    "A team member left.": { ko: "팀 멤버가 팀을 떠났습니다.", ja: "チームメンバーが退出しました。", en: "A team member left.", fr: "Un membre a quitté l'équipe.", es: "Un miembro salió del equipo." },
    "No message": { ko: "메시지 없음", ja: "メッセージなし", en: "No message", fr: "Aucun message", es: "Sin mensaje" },
    "Request update failed": { ko: "요청 처리 실패", ja: "リクエスト更新失敗", en: "Request update failed", fr: "Échec de mise à jour", es: "Error al actualizar solicitud" },
    "Failed to update request.": { ko: "요청 처리에 실패했습니다.", ja: "リクエスト更新に失敗しました。", en: "Failed to update request.", fr: "Impossible de mettre à jour la demande.", es: "No se pudo actualizar la solicitud." },
    "Download": { ko: "다운로드", ja: "ダウンロード", en: "Download", fr: "Télécharger", es: "Descargar" },
    "Downloading...": { ko: "다운로드 중...", ja: "ダウンロード中...", en: "Downloading...", fr: "Téléchargement...", es: "Descargando..." },
    "Chat": { ko: "채팅", ja: "チャット", en: "Chat", fr: "Chat", es: "Chat" },
    "No messages yet.": { ko: "아직 메시지가 없습니다.", ja: "まだメッセージがありません。", en: "No messages yet.", fr: "Pas encore de messages.", es: "Aún no hay mensajes." },
    "No approved chat connections yet.": { ko: "승인된 채팅 연결이 없습니다.", ja: "承認されたチャット接続がありません。", en: "No approved chat connections yet.", fr: "Aucune connexion de chat approuvée.", es: "Aún no hay conexiones de chat aprobadas." },
    "No team found.": { ko: "팀이 없습니다.", ja: "チームが見つかりません。", en: "No team found.", fr: "Aucune équipe trouvée.", es: "No se encontró equipo." },
    "Loading messages...": { ko: "메시지 불러오는 중...", ja: "メッセージ読み込み中...", en: "Loading messages...", fr: "Chargement des messages...", es: "Cargando mensajes..." },
    "Select a profile on the left to open a chat thread.": { ko: "왼쪽에서 프로필을 선택해 채팅을 시작하세요.", ja: "左のプロフィールを選んでチャットを開いてください。", en: "Select a profile on the left to open a chat thread.", fr: "Sélectionnez un profil à gauche pour ouvrir un chat.", es: "Selecciona un perfil a la izquierda para abrir un chat." },
    "No messages yet. Start the conversation.": { ko: "아직 메시지가 없습니다. 대화를 시작해보세요.", ja: "まだメッセージがありません。会話を始めましょう。", en: "No messages yet. Start the conversation.", fr: "Pas encore de messages. Commencez la conversation.", es: "Aún no hay mensajes. Comienza la conversación." },
    "You": { ko: "나", ja: "あなた", en: "You", fr: "Vous", es: "Tú" },
    "Type a message...": { ko: "메시지를 입력하세요...", ja: "メッセージを入力...", en: "Type a message...", fr: "Tapez un message...", es: "Escribe un mensaje..." },
    "Select a thread first": { ko: "먼저 대화를 선택하세요", ja: "先にスレッドを選択してください", en: "Select a thread first", fr: "Sélectionnez d'abord un fil", es: "Primero selecciona un hilo" },
    "Friends": { ko: "친구", ja: "友達", en: "Friends", fr: "Amis", es: "Amigos" },
    "No friends yet.": { ko: "아직 친구가 없습니다.", ja: "まだ友達がいません。", en: "No friends yet.", fr: "Aucun ami pour le moment.", es: "Aún no hay amigos." },
    "Your accepted friend list.": { ko: "수락된 친구 목록입니다.", ja: "承認済みの友達一覧です。", en: "Your accepted friend list.", fr: "Votre liste d'amis acceptés.", es: "Tu lista de amigos aceptados." },
    "Send Team Invite": { ko: "팀 초대 보내기", ja: "チーム招待を送る", en: "Send Team Invite", fr: "Envoyer une invitation d'équipe", es: "Enviar invitación al equipo" },
    "Failed to send invite.": { ko: "초대 전송에 실패했습니다.", ja: "招待送信に失敗しました。", en: "Failed to send invite.", fr: "Échec de l'envoi de l'invitation.", es: "No se pudo enviar la invitación." },
    "Please select a team.": { ko: "팀을 선택해 주세요.", ja: "チームを選択してください。", en: "Please select a team.", fr: "Veuillez sélectionner une équipe.", es: "Selecciona un equipo." },
    "Write a short invite message...": { ko: "짧은 초대 메시지를 입력하세요...", ja: "短い招待メッセージを入力...", en: "Write a short invite message...", fr: "Écrivez un court message d'invitation...", es: "Escribe un mensaje breve de invitación..." },
    "Invite unavailable": { ko: "초대 불가", ja: "招待할 수 없음", en: "Invite unavailable", fr: "Invitation indisponible", es: "Invitación no disponible" },
    "You need at least one team to send an invite.": { ko: "초대를 보내려면 최소 1개 팀이 필요합니다.", ja: "招待を送るには少なくとも1つのチームが必要です。", en: "You need at least one team to send an invite.", fr: "Vous devez avoir au moins une équipe pour inviter.", es: "Necesitas al menos un equipo para enviar una invitación." },
    "Remove Friend?": { ko: "친구를 삭제할까요?", ja: "友達を削除しますか？", en: "Remove Friend?", fr: "Supprimer cet ami ?", es: "¿Eliminar amigo?" },
    "Unfriend": { ko: "친구 삭제", ja: "友達解除", en: "Unfriend", fr: "Retirer des amis", es: "Eliminar amigo" },
    "Unknown": { ko: "알 수 없음", ja: "不明", en: "Unknown", fr: "Inconnu", es: "Desconocido" },
    "No details": { ko: "상세 정보 없음", ja: "詳細なし", en: "No details", fr: "Pas de détails", es: "Sin detalles" },
    "Welcome back": { ko: "다시 오신 것을 환영합니다", ja: "おかえりなさい", en: "Welcome back", fr: "Bon retour", es: "Bienvenido de nuevo" },
    "Sign in to your account": { ko: "계정에 로그인하세요", ja: "アカウントにサインイン", en: "Sign in to your account", fr: "Connectez-vous à votre compte", es: "Inicia sesión en tu cuenta" },
    "Sign In": { ko: "로그인", ja: "サインイン", en: "Sign In", fr: "Se connecter", es: "Iniciar sesión" },
    "Sign Up": { ko: "가입하기", ja: "登録する", en: "Sign Up", fr: "S'inscrire", es: "Registrarse" },
    "Create account": { ko: "계정 만들기", ja: "アカウント作成", en: "Create account", fr: "Créer un compte", es: "Crear cuenta" },
    "Email": { ko: "이메일", ja: "メール", en: "Email", fr: "E-mail", es: "Correo electrónico" },
    "Password": { ko: "비밀번호", ja: "パスワード", en: "Password", fr: "Mot de passe", es: "Contraseña" },
    "User Name": { ko: "사용자 이름", ja: "ユーザー名", en: "User Name", fr: "Nom d'utilisateur", es: "Nombre de usuario" },
    "Age": { ko: "나이", ja: "年齢", en: "Age", fr: "Âge", es: "Edad" },
    "Country": { ko: "국가", ja: "国", en: "Country", fr: "Pays", es: "País" },
    "Korean": { ko: "한국어", ja: "韓国語", en: "Korean", fr: "Coréen", es: "Coreano" },
    "Japanese": { ko: "일본어", ja: "日本語", en: "Japanese", fr: "Japonais", es: "Japonés" },
    "English": { ko: "영어", ja: "英語", en: "English", fr: "Anglais", es: "Inglés" },
    "French": { ko: "프랑스어", ja: "フランス語", en: "French", fr: "Français", es: "Francés" },
    "Spanish": { ko: "스페인어", ja: "スペイン語", en: "Spanish", fr: "Espagnol", es: "Español" },
    "Gender": { ko: "성별", ja: "性別", en: "Gender", fr: "Genre", es: "Género" },
    "Select gender": { ko: "성별 선택", ja: "性別を選択", en: "Select gender", fr: "Sélectionner le genre", es: "Seleccionar género" },
    "Male": { ko: "남성", ja: "男性", en: "Male", fr: "Homme", es: "Masculino" },
    "Female": { ko: "여성", ja: "女性", en: "Female", fr: "Femme", es: "Femenino" },
    "Other": { ko: "기타", ja: "その他", en: "Other", fr: "Autre", es: "Otro" },
    "읽음": { ko: "읽음", ja: "既読", en: "Read", fr: "Lu", es: "Leído" },
    "안읽음": { ko: "안읽음", ja: "未読", en: "Unread", fr: "Non lu", es: "No leído" },
    "팀 프로필 보기": { ko: "팀 프로필 보기", ja: "チームプロフィール", en: "Team Profile", fr: "Profil d'équipe", es: "Perfil del equipo" },
    "프로필 보기": { ko: "프로필 보기", ja: "プロフィールを見る", en: "View Profile", fr: "Voir le profil", es: "Ver perfil" },
    "일부 데이터 로드 실패": { ko: "일부 데이터 로드 실패", ja: "一部データの読み込み失敗", en: "Partial data load failed", fr: "Échec de chargement partiel", es: "Error parcial de carga" },
    "일부 데이터만 먼저 표시됩니다. 잠시 후 다시 시도해 주세요.": { ko: "일부 데이터만 먼저 표시됩니다. 잠시 후 다시 시도해 주세요.", ja: "一部のデータのみ先に表示されます。しばらくして再試行してください。", en: "Only partial data is shown first. Please try again shortly.", fr: "Seules certaines données sont affichées. Réessayez dans un instant.", es: "Solo se muestran datos parciales. Inténtalo de nuevo en un momento." },
    "로드 실패": { ko: "로드 실패", ja: "読み込み失敗", en: "Load failed", fr: "Échec du chargement", es: "Error de carga" },
    "Discovery 데이터를 불러오지 못했습니다.": { ko: "Discovery 데이터를 불러오지 못했습니다.", ja: "Discoveryデータの取得に失敗しました。", en: "Failed to load discovery data.", fr: "Impossible de charger les données Discovery.", es: "No se pudieron cargar los datos de Discovery." },
    "정말로 팀을 떠나시겠습니까?": { ko: "정말로 팀을 떠나시겠습니까?", ja: "本当にチームを退出しますか？", en: "Are you sure you want to leave this team?", fr: "Voulez-vous vraiment quitter cette équipe ?", es: "¿Seguro que quieres salir de este equipo?" },
};

type PatternTranslator = (language: AppLanguage, match: RegExpMatchArray) => string;

const DYNAMIC_PATTERNS: Array<{ pattern: RegExp; translate: PatternTranslator }> = [
    {
        pattern: /^Step (\d+) \/ (\d+)$/,
        translate: (language, match) => {
            const current = match[1];
            const total = match[2];
            if (language === "ko") return `단계 ${current} / ${total}`;
            if (language === "ja") return `ステップ ${current} / ${total}`;
            if (language === "fr") return `Étape ${current} / ${total}`;
            if (language === "es") return `Paso ${current} / ${total}`;
            return `Step ${current} / ${total}`;
        },
    },
    {
        pattern: /^Team: (.+)$/,
        translate: (language, match) => {
            const value = match[1];
            if (language === "ko") return `팀: ${value}`;
            if (language === "ja") return `チーム: ${value}`;
            if (language === "fr") return `Équipe : ${value}`;
            if (language === "es") return `Equipo: ${value}`;
            return `Team: ${value}`;
        },
    },
    {
        pattern: /^To: (.+)$/,
        translate: (language, match) => {
            const value = match[1];
            if (language === "ko") return `대상: ${value}`;
            if (language === "ja") return `宛先: ${value}`;
            if (language === "fr") return `À : ${value}`;
            if (language === "es") return `Para: ${value}`;
            return `To: ${value}`;
        },
    },
    {
        pattern: /^(.+)\s-\sTeams\s(\d+),\sPeople\s(\d+)$/,
        translate: (language, match) => {
            const query = match[1];
            const teams = match[2];
            const people = match[3];
            if (language === "ko") return `${query} - 팀 ${teams}, 사람 ${people}`;
            if (language === "ja") return `${query} - チーム ${teams}、人 ${people}`;
            if (language === "fr") return `${query} - Équipes ${teams}, Personnes ${people}`;
            if (language === "es") return `${query} - Equipos ${teams}, Personas ${people}`;
            return `${query} - Teams ${teams}, People ${people}`;
        },
    },
    {
        pattern: /^Resend in (\d+)s$/,
        translate: (language, match) => {
            const seconds = match[1];
            if (language === "ko") return `${seconds}초 후 재전송`;
            if (language === "ja") return `${seconds}秒後に再送`;
            if (language === "fr") return `Renvoyer dans ${seconds}s`;
            if (language === "es") return `Reenviar en ${seconds}s`;
            return `Resend in ${seconds}s`;
        },
    },
];

export function translateLiteral(language: AppLanguage, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const direct = LITERAL_MESSAGES[trimmed];
    if (direct) return direct[language];

    for (const item of DYNAMIC_PATTERNS) {
        const match = trimmed.match(item.pattern);
        if (match) return item.translate(language, match);
    }

    return null;
}
