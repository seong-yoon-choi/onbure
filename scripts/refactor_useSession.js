import { Project } from "ts-morph";

function run() {
    const project = new Project({
        tsConfigFilePath: "tsconfig.json",
    });

    const sourceFiles = project.getSourceFiles(["app/**/*.tsx", "components/**/*.tsx", "app/**/*.ts", "components/**/*.ts"]);

    console.log(`Found ${sourceFiles.length} client files to check for useSession.`);

    let changedCount = 0;

    for (const sourceFile of sourceFiles) {
        let changed = false;

        const imports = sourceFile.getImportDeclarations();
        const nextAuthImport = imports.find((i) => i.getModuleSpecifierValue() === "next-auth/react");

        if (nextAuthImport) {
            const namedImports = nextAuthImport.getNamedImports();
            const hasUseSession = namedImports.some(i => i.getName() === "useSession");
            const hasOtherImports = namedImports.length > 1;

            if (hasUseSession) {
                if (hasOtherImports) {
                    const useSessionImport = namedImports.find(i => i.getName() === "useSession");
                    useSessionImport.remove();
                } else {
                    nextAuthImport.remove();
                }

                sourceFile.addImportDeclaration({
                    namedImports: ["useSession"],
                    moduleSpecifier: "@/lib/supabase/useSession"
                });

                changed = true;
            }
        }

        if (changed) {
            sourceFile.saveSync();
            changedCount++;
            console.log(`Updated ${sourceFile.getFilePath()}`);
        }
    }

    console.log(`Updated ${changedCount} useSession client files.`);
}

run();
