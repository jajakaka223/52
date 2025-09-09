const fs = require('fs');
const path = require('path');

// Функция для замены API вызовов в файле
function fixApiCalls(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Добавляем импорт getApiUrl если его нет
  if (!content.includes('getApiUrl') && content.includes("axios.")) {
    const importMatch = content.match(/import.*from ['"]axios['"];?/);
    if (importMatch) {
      content = content.replace(
        importMatch[0],
        importMatch[0] + '\nimport { getApiUrl } from \'../config/api\';'
      );
    }
  }
  
  // Заменяем все axios вызовы с /api/ на getApiUrl
  content = content.replace(
    /axios\.(get|post|put|delete)\(['"`]\/api\//g,
    'axios.$1(getApiUrl(\'/api/'
  );
  
  // Закрываем скобки
  content = content.replace(
    /getApiUrl\(['"`]\/api\/([^'"`]+)['"`]\)/g,
    'getApiUrl(\'/api/$1\')'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

// Функция для рекурсивного поиска файлов
function findFiles(dir, pattern) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(item)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Находим все JS файлы в web/src
const jsFiles = findFiles('web/src', /\.js$/);

console.log('Fixing API calls in files:');
jsFiles.forEach(fixApiCalls);

console.log('Done!');
