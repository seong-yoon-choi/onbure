import { Project } from "ts-morph";

function run() {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const sourceFiles = project.getSourceFiles("app/api/**/*.ts");

    // First pass: replace getServerSession with createClient
    console.log(`Found ${sourceFiles.length} API routes to check.`);

    let changedCount = 0;

    for (const sourceFile of sourceFiles) {
        let changed = false;

        // Find NextAuth imports
        const imports = sourceFile.getImportDeclarations();
        const nextAuthImport = imports.find((i) => i.getModuleSpecifierValue() === "next-auth/next");
        const nextAuthRouteImport = imports.find((i) => i.getModuleSpecifierValue() === "next-auth");
        const authOptionsImport = imports.find((i) => i.getModuleSpecifierValue().includes("lib/auth"));
        const supabaseServerImport = imports.find((i) => i.getModuleSpecifierValue() === "@/lib/supabase/server");

        if (nextAuthImport || nextAuthRouteImport || authOptionsImport) {
            // Remove NextAuth imports
            if (nextAuthImport) nextAuthImport.remove();
            if (nextAuthRouteImport) nextAuthRouteImport.remove();
            if (authOptionsImport) authOptionsImport.remove();
            changed = true;
        }

        // Add Supabase import if we need it (if we have a session check)
        // We'll figure this out by looking for getServerSession calls first
        const callExpressions = sourceFile.getDescendantsOfKind(Project.SyntaxKind?.CallExpression || 210);
        const sessionCalls = callExpressions.filter(c => {
            const exp = c.getExpression();
            return exp.getText() === "getServerSession";
        });

        if (sessionCalls.length > 0) {
            if (!supabaseServerImport) {
                sourceFile.addImportDeclaration({
                    namedImports: ["createClient"],
                    moduleSpecifier: "@/lib/supabase/server"
                });
            }

            for (const call of sessionCalls) {
                // Replace `await getServerSession(authOptions)` with:
                // `(await (await createClient()).auth.getUser()).data`
                // BUT, to keep types simple and avoid double await inline which can be tricky,
                // let's do a textual replacement for the whole variable declaration or assignment if possible.

                const parent = call.getParent(); // AwaitExpression usually
                if (parent.getKindName() === "AwaitExpression") {
                    const varDecl = parent.getParent(); // VariableDeclaration: const session = await getServerSession(...)
                    if (varDecl.getKindName() === "VariableDeclaration") {
                        // Change `const session = ...` to `const supabase = await createClient(); const { data: { user: sessionUser } } = await supabase.auth.getUser(); const session = sessionUser ? { user: { id: sessionUser.id, email: sessionUser.email, name: sessionUser.user_metadata.username } } : null;`

                        // To make it easy, we replace the `await getServerSession` with a helper function call that we inject, OR
                        // we just replace the await text.
                        parent.replaceWithText(`await (async () => { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return user ? { user: { id: user.id, email: user.email, name: user.user_metadata.username } } : null; })()`);
                    } else {
                        parent.replaceWithText(`await (async () => { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return user ? { user: { id: user.id, email: user.email, name: user.user_metadata.username } } : null; })()`);
                    }
                } else {
                    call.replaceWithText(`(async () => { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return user ? { user: { id: user.id, email: user.email, name: user.user_metadata.username } } : null; })()`);
                }
            }
            changed = true;
        }

        if (changed) {
            sourceFile.saveSync();
            changedCount++;
            console.log(`Updated ${sourceFile.getFilePath()}`);
        }
    }

    console.log(`Updated ${changedCount} files.`);
}

run();
