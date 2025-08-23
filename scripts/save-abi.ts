import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

function saveAbis(): void {
  const artifactsPath = "./artifacts/contracts";
  const abiDir = "./front/src/contracts/abis/";

  // Создаем директорию для ABI если её нет
  if (!existsSync(abiDir)) {
    mkdirSync(abiDir, { recursive: true });
  }

  // Рекурсивная функция для поиска артефактов
  const findArtifacts = (dir: string): void => {
    const files = readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = join(dir, file.name);
      
      if (file.isDirectory()) {
        findArtifacts(fullPath);
      } else if (file.name.endsWith(".json") && !file.name.endsWith(".dbg.json")) {
        try {
          const artifactContent = readFileSync(fullPath, "utf8");
          const artifact = JSON.parse(artifactContent);
          
          if (artifact.abi && artifact.abi.length > 0) {
            const abiFileName = file.name;
            const outputPath = join(abiDir, abiFileName);
            
            writeFileSync(
              outputPath,
              JSON.stringify(artifact.abi, null, 2)
            );
            
            console.log(`✅ Saved ABI: ${abiFileName}`);
          }
        } catch (error) {
          console.warn(`⚠️  Could not process ${fullPath}:`, error);
        }
      }
    }
  };

  console.log("🚀 Saving ABIs...");
  findArtifacts(artifactsPath);
  console.log("🎉 All ABIs saved successfully!");
}

// Запускаем если файл вызван напрямую
if (require.main === module) {
  saveAbis();
}

export { saveAbis };