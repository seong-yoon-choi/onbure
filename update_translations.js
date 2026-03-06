/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const keysWithTranslations = {
    "discovery.open_team_profile": { en: "Open Team Profile", ko: "팀 프로필 열기", ja: "チームプロフィールを開く", fr: "Ouvrir le profil de l'équipe", es: "Abrir perfil de equipo" },
    "discovery.open_user_profile": { en: "Open User Profile", ko: "유저 프로필 열기", ja: "ユーザープロフィールを開く", fr: "Ouvrir le profil utilisateur", es: "Abrir perfil de usuario" },
    "discovery.team_request": { en: "Team Request", ko: "팀 가입 요청", ja: "チーム参加リクエスト", fr: "Demande d'équipe", es: "Solicitud de equipo" },
    "discovery.create_team": { en: "Create Team", ko: "팀 생성", ja: "チーム作成", fr: "Créer une équipe", es: "Crear equipo" },
    "discovery.tab_team": { en: "Team Tab", ko: "팀 탭", ja: "チームタブ", fr: "Onglet Équipe", es: "Pestaña Equipo" },
    "discovery.tab_people": { en: "People Tab", ko: "피플 탭", ja: "ピープルタブ", fr: "Onglet Personnes", es: "Pestaña Personas" },
    "myteam.edit_profile": { en: "Edit Profile", ko: "프로필 편집", ja: "プロフィール編集", fr: "Modifier le profil", es: "Editar perfil" },
    "myteam.delete_team": { en: "Delete Team", ko: "팀 삭제", ja: "チーム削除", fr: "Supprimer l'équipe", es: "Eliminar equipo" },
    "team.member_profile_button": { en: "Member Profile", ko: "멤버 프로필", ja: "メンバープロフィール", fr: "Profil du membre", es: "Perfil del miembro" },
    "friends.open_profile": { en: "Open Profile", ko: "프로필 열기", ja: "プロフィールを開く", fr: "Ouvrir le profil", es: "Abrir perfil" },
    "friends.chat": { en: "Chat", ko: "채팅", ja: "チャット", fr: "Chat", es: "Chat" },
    "friends.invite": { en: "Invite", ko: "초대", ja: "招待", fr: "Inviter", es: "Invitar" },
    "friends.context_menu_open_profile": { en: "Context Menu: Open Profile", ko: "컨텍스트 메뉴: 프로필 열기", ja: "コンテキストメニュー: プロフィールを開く", fr: "Menu contextuel : Ouvrir le profil", es: "Menú contextual: Abrir perfil" },
    "friends.context_menu_unfriend": { en: "Context Menu: Unfriend", ko: "컨텍스트 메뉴: 친구 삭제", ja: "コンテキストメニュー: 友達から削除", fr: "Menu contextuel : Retirer des amis", es: "Menú contextual: Eliminar amigo" },
    "profile.save_change": { en: "Save Changes", ko: "변경사항 저장", ja: "変更を保存", fr: "Enregistrer les modifications", es: "Guardar cambios" },
    "profile.change_name": { en: "Change Name", ko: "이름 변경", ja: "名前を変更", fr: "Changer de nom", es: "Cambiar nombre" },
    "profile.change_email": { en: "Change Email", ko: "이메일 변경", ja: "メールアドレスを変更", fr: "Changer d'e-mail", es: "Cambiar correo electrónico" },
    "profile.delete_account": { en: "Delete Account", ko: "계정 삭제", ja: "アカウント削除", fr: "Supprimer le compte", es: "Eliminar cuenta" },
    "nav.discovery": { en: "Nav: Discovery", ko: "네비게이션: 디스커버리", ja: "ナビ: ディスカバリー", fr: "Nav : Découverte", es: "Nav: Descubrimiento" },
    "nav.friends": { en: "Nav: Friends", ko: "네비게이션: 친구", ja: "ナビ: 友達", fr: "Nav : Amis", es: "Nav: Amigos" },
    "nav.my_team": { en: "Nav: My Team", ko: "네비게이션: 내 팀", ja: "ナビ: マイチーム", fr: "Nav : Mon équipe", es: "Nav: Mi equipo" },
    "nav.search": { en: "Nav: Search", ko: "네비게이션: 검색", ja: "ナビ: 検索", fr: "Nav : Recherche", es: "Nav: Búsqueda" },
    "nav.notice": { en: "Nav: Notice", ko: "네비게이션: 알림", ja: "ナビ: お知らせ", fr: "Nav : Notification", es: "Nav: Notificación" },
    "nav.chat": { en: "Nav: Chat", ko: "네비게이션: 채팅", ja: "ナビ: チャット", fr: "Nav : Chat", es: "Nav: Chat" },
    "nav.qna_feedback": { en: "Nav: QnA/Feedback", ko: "네비게이션: QnA/피드백", ja: "ナビ: QnA/フィードバック", fr: "Nav : QnA/Retours", es: "Nav: QnA/Comentarios" },
    "nav.admin_dashboard": { en: "Nav: Admin Dashboard", ko: "네비게이션: 관리자 대시보드", ja: "ナビ: 管理者ダッシュボード", fr: "Nav : Tableau de bord admin", es: "Nav: Panel de administración" },
    "nav.my_profile": { en: "Nav: My Profile", ko: "네비게이션: 내 프로필", ja: "ナビ: マイプロフィール", fr: "Nav : Mon profil", es: "Nav: Mi perfil" },
    "nav.logout": { en: "Nav: Logout", ko: "네비게이션: 로그아웃", ja: "ナビ: ログアウト", fr: "Nav : Déconnexion", es: "Nav: Cerrar sesión" },
    "nav.signIn": { en: "Nav: Sign In", ko: "네비게이션: 로그인", ja: "ナビ: サインイン", fr: "Nav : Connexion", es: "Nav: Iniciar sesión" },
    "myteam.create_folder": { en: "Create Folder", ko: "폴더 생성", ja: "フォルダ作成", fr: "Créer un dossier", es: "Crear carpeta" },
    "myteam.import_file": { en: "Import File", ko: "파일 가져오기", ja: "ファイルインポート", fr: "Importer un fichier", es: "Importar archivo" },
    "myteam.import_folder": { en: "Import Folder", ko: "폴더 가져오기", ja: "フォルダインポート", fr: "Importer un dossier", es: "Importar carpeta" },
    "myteam.drag_group": { en: "Drag Group", ko: "그룹 드래그", ja: "グループのドラッグ", fr: "Faire glisser le groupe", es: "Arrastrar grupo" },
    "myteam.drag_file": { en: "Drag File", ko: "파일 드래그", ja: "ファイルのドラッグ", fr: "Faire glisser le fichier", es: "Arrastrar archivo" },
    "myteam.drag_member": { en: "Drag Member", ko: "멤버 드래그", ja: "メンバーのドラッグ", fr: "Faire glisser le membre", es: "Arrastrar miembro" },
    "myteam.member_click": { en: "Click Member", ko: "멤버 클릭", ja: "メンバークリック", fr: "Cliquer sur le membre", es: "Hacer clic en el miembro" },
    "myteam.create_group": { en: "Create Group", ko: "그룹 생성", ja: "グループ作成", fr: "Créer un groupe", es: "Crear grupo" },
    "myteam.ctrl_drag_add_to_group": { en: "Ctrl Drag Add to Group", ko: "Ctrl 드래그 그룹에 추가", ja: "Ctrl ドラッグでグループに追加", fr: "Ctrl Glisser Ajouter au groupe", es: "Ctrl Arrastrar Añadir al grupo" },
    "myteam.open_files_menu": { en: "Open Files Menu", ko: "파일 메뉴 열기", ja: "ファイルメニューを開く", fr: "Ouvrir le menu des fichiers", es: "Abrir menú de archivos" },
    "myteam.change_member_role": { en: "Change Member Role", ko: "멤버 역할 변경", ja: "メンバーの役割を変更", fr: "Changer le rôle du membre", es: "Cambiar rol de miembro" },
    "myteam.open_members_panel": { en: "Open Members Panel", ko: "멤버 패널 열기", ja: "メンバーパネルを開く", fr: "Ouvrir le panneau des membres", es: "Abrir panel de miembros" },
    "myteam.open_files_panel": { en: "Open Files Panel", ko: "파일 패널 열기", ja: "ファイルパネルを開く", fr: "Ouvrir le panneau des fichiers", es: "Abrir panel de archivos" },
    "myteam.open_groups_panel": { en: "Open Groups Panel", ko: "그룹 패널 열기", ja: "グループパネルを開く", fr: "Ouvrir le panneau des groupes", es: "Abrir panel de grupos" },
    "myteam.switch_my_workspace": { en: "Switch My Workspace", ko: "마이 워크스페이스 전환", ja: "マイワークスペース切り替え", fr: "Passer à Mon espace de travail", es: "Cambiar a Mi espacio de trabajo" },
    "myteam.switch_team_workspace": { en: "Switch Team Workspace", ko: "팀 워크스페이스 전환", ja: "チームワークスペース切り替え", fr: "Passer à l'espace de travail d'équipe", es: "Cambiar al espacio de trabajo del equipo" },
    "myteam.dropdown_create_team": { en: "Dropdown Create Team", ko: "드롭다운: 팀 생성", ja: "ドロップダウン: チーム作成", fr: "Liste déroulante : Créer une équipe", es: "Desplegable: Crear equipo" }
};

const file = 'lib/i18n/workspace-overrides.ts';
let content = fs.readFileSync(file, 'utf8');

['ko', 'ja', 'en', 'fr', 'es'].forEach(lang => {
    const langHeader = `    ${lang}: {`;
    const startIndex = content.indexOf(langHeader);
    if (startIndex === -1) return;

    let endIndex = content.indexOf('    },', startIndex + langHeader.length);
    if (endIndex === -1) {
        endIndex = content.indexOf('    }', startIndex + langHeader.length);
    }

    if (endIndex !== -1) {
        let lines = '';
        for (const [key, mapping] of Object.entries(keysWithTranslations)) {
            if (!content.includes(`"${key}"`)) {
                lines += `        "${key}": "${mapping[lang]}",\n`;
            }
        }
        content = content.slice(0, endIndex) + lines + content.slice(endIndex);
    }
});

fs.writeFileSync(file, content);
