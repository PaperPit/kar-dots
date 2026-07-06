/**
 * Добавляет описания разрешений iOS (микрофон, речь, фото) в Info.plist.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PLIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../ios/App/App/Info.plist',
);

if (!fs.existsSync(PLIST)) {
  console.warn('patch-ios-plist: Info.plist не найден (сначала npm run ios:add)');
  process.exit(0);
}

const KEYS = {
  NSMicrophoneUsageDescription:
    'Микрофон нужен для режима «Голос» — произнесите перевод вслух.',
  NSSpeechRecognitionUsageDescription:
    'Распознавание речи нужно для проверки ответа в режиме «Голос».',
  NSCameraUsageDescription:
    'Камера нужна, чтобы сфотографировать картинку для карточки.',
  NSPhotoLibraryUsageDescription:
    'Доступ к фото нужен, чтобы выбрать картинку для карточки.',
};

let xml = fs.readFileSync(PLIST, 'utf8');
for (const [key, text] of Object.entries(KEYS)) {
  if (xml.includes(`<key>${key}</key>`)) continue;
  const block = `\t<key>${key}</key>\n\t<string>${text}</string>\n`;
  xml = xml.replace('</dict>\n</plist>', `${block}</dict>\n</plist>`);
}

fs.writeFileSync(PLIST, xml);
console.log('Info.plist: разрешения обновлены');
