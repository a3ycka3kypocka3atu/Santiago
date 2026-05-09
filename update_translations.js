const fs = require('fs');

const path = '/Users/andrij/Desktop/Anti/Сайт/translations.js';
let content = fs.readFileSync(path, 'utf8');

// Extract the translations object
const prefix = "const translations = ";
const startIndex = content.indexOf(prefix) + prefix.length;
const objectStr = content.substring(startIndex, content.lastIndexOf(';') > content.lastIndexOf('}') ? content.lastIndexOf(';') : content.lastIndexOf('}') + 1);

let translations;
try {
  translations = eval('(' + objectStr + ')');
} catch (e) {
  console.error("Failed to parse translations:", e);
  process.exit(1);
}

const updates = {
  ru: {
    "nav.club": "Клуб и Инкубатор",
    "hero.cta1": "Посмотреть услуги",
    "hero.cta2": "Программа событий",
    "hero.cta3": "Присоединиться к коллективу",
    "studio.title": "Студия Сантьяго",
    "studio.1.title": "Расписание",
    "studio.1.desc": "Календарь занятий и запись.",
    "studio.2.title": "Мастера",
    "studio.2.desc": "Галерея и профили инструкторов.",
    "studio.3.title": "Наше пространство",
    "studio.3.desc": "Фото зала, описание оборудования и атмосферы.",
    "inst.title": "Инструкторам и партнёрам",
    "inst.1.title": "Аренда пространства",
    "inst.1.desc": "Цены и условия аренды зала.",
    "inst.2.title": "Сотрудничество",
    "inst.2.desc": "Предложения по партнерству, кросс-промо, совместным мероприятиям и B2B.",
    "inst.3.title": "Open Mic",
    "inst.3.desc": "Заявка на проведение и тестирование своего авторского формата/практики.",
    "club.title": "Клуб и Инкубатор Сантьяго",
    "club.1.title": "О клубе",
    "club.1.desc": "Описание нашей философии — как мы сотрудничаем, помогаем друг другу по жизни и в запуске проектов (включая коливинг).",
    "club.2.title": "Наши проекты",
    "club.2.desc": "То, над чем мы уже работаем, и идеи, которые ищут реализации.",
    "club.3.title": "Как присоединиться",
    "club.3.desc": "Условия вступления в коллектив и механика того, как мы работаем вместе."
  },
  ua: {
    "nav.club": "Клуб та Інкубатор",
    "hero.cta1": "Подивитися послуги",
    "hero.cta2": "Розглянути програму подій",
    "hero.cta3": "Приєднатися до колективу",
    "studio.title": "Студія Сантьяго",
    "studio.1.title": "Розклад",
    "studio.1.desc": "Календар занять та запис.",
    "studio.2.title": "Майстри",
    "studio.2.desc": "Галерея та профілі інструкторів.",
    "studio.3.title": "Наш простір",
    "studio.3.desc": "Фото залу, опис обладнання та атмосфери.",
    "inst.title": "Інструкторам та партнерам",
    "inst.1.title": "Оренда простору",
    "inst.1.desc": "Ціни та умови оренди залу.",
    "inst.2.title": "Співпраця",
    "inst.2.desc": "Пропозиції щодо партнерства, крос-промо, спільних заходів та B2B-взаємодії.",
    "inst.3.title": "Open Mic",
    "inst.3.desc": "Заявка на проведення та тестування свого авторського формату/практики.",
    "club.title": "Клуб та Інкубатор Сантьяго",
    "club.1.title": "Про клуб",
    "club.1.desc": "Опис нашої філософії — як ми співпрацюємо, допомагаємо одне одному по життю та в запуску проєктів (включно з колівінгом).",
    "club.2.title": "Наші проєкти",
    "club.2.desc": "Те, над чим ми вже працюємо, та ідеї, які шукають реалізації.",
    "club.3.title": "Як приєднатися",
    "club.3.desc": "Умови вступу до колективу та механіка того, як ми працюємо разом."
  },
  en: {
    "nav.club": "Club & Incubator",
    "hero.cta1": "View Services",
    "hero.cta2": "View Event Program",
    "hero.cta3": "Join the Team",
    "studio.title": "Santiago Studio",
    "studio.1.title": "Schedule",
    "studio.1.desc": "Class calendar and booking.",
    "studio.2.title": "Masters",
    "studio.2.desc": "Gallery and instructor profiles.",
    "studio.3.title": "Our Space",
    "studio.3.desc": "Hall photos, equipment and atmosphere description.",
    "inst.title": "For Instructors & Partners",
    "inst.1.title": "Space Rental",
    "inst.1.desc": "Prices and conditions for renting the hall.",
    "inst.2.title": "Collaboration",
    "inst.2.desc": "Partnership offers, cross-promotions, joint events, and B2B interactions.",
    "inst.3.title": "Open Mic",
    "inst.3.desc": "Application to host and test your own author's format/practice.",
    "club.title": "Santiago Club & Incubator",
    "club.1.title": "About the Club",
    "club.1.desc": "Description of our philosophy — how we cooperate, help each other in life and in launching projects (including coliving).",
    "club.2.title": "Our Projects",
    "club.2.desc": "What we are already working on, and ideas looking for realization.",
    "club.3.title": "How to Join",
    "club.3.desc": "Conditions for joining the collective and the mechanics of how we work together."
  },
  cz: {
    "nav.club": "Klub a Inkubátor",
    "hero.cta1": "Zobrazit služby",
    "hero.cta2": "Zobrazit program událostí",
    "hero.cta3": "Připojit se k týmu",
    "studio.title": "Studio Santiago",
    "studio.1.title": "Rozvrh",
    "studio.1.desc": "Kalendář lekcí a rezervace.",
    "studio.2.title": "Mistři",
    "studio.2.desc": "Galerie a profily instruktorů.",
    "studio.3.title": "Náš prostor",
    "studio.3.desc": "Fotografie sálu, popis vybavení a atmosféry.",
    "inst.title": "Pro instruktory a partnery",
    "inst.1.title": "Pronájem prostoru",
    "inst.1.desc": "Ceny a podmínky pronájmu sálu.",
    "inst.2.title": "Spolupráce",
    "inst.2.desc": "Nabídky partnerství, cross-promo, společné akce a B2B interakce.",
    "inst.3.title": "Open Mic",
    "inst.3.desc": "Přihláška k pořádání a testování vlastního autorského formátu/praxe.",
    "club.title": "Klub a Inkubátor Santiago",
    "club.1.title": "O klubu",
    "club.1.desc": "Popis naší filozofie — jak spolupracujeme, pomáháme si v životě a při spouštění projektů (včetně colivingu).",
    "club.2.title": "Naše projekty",
    "club.2.desc": "Na čem už pracujeme a nápady, které hledají realizaci.",
    "club.3.title": "Jak se připojit",
    "club.3.desc": "Podmínky vstupu do kolektivu a mechanika naší spolupráce."
  }
};

for (const lang in updates) {
  for (const key in updates[lang]) {
    translations[lang][key] = updates[lang][key];
  }
}

const restOfFile = content.substring(content.lastIndexOf(';') > content.lastIndexOf('}') ? content.lastIndexOf(';') + 1 : content.lastIndexOf('}') + 1);

const newContent = "const translations = " + JSON.stringify(translations, null, 2) + ";" + restOfFile;
fs.writeFileSync(path, newContent, 'utf8');
console.log("Translations updated successfully.");
