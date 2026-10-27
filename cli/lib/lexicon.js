// One table per concept, one row per language. compose-brief.js and caption.js build their matchers from these
// tables, so a new language is a new row, not a new regex scattered through the code. Words are lower case; a
// phrase may have spaces. Latin, Cyrillic, Greek, Arabic and Hebrew words are matched as whole words (Unicode
// aware); Japanese / Chinese / Korean entries are matched anywhere, since those scripts do not put spaces between
// words.
//
// Languages: en es pt fr de it nl pl tr sr (Serbian / Croatian / Bosnian, Latin and Cyrillic) ru uk el ar, plus a
// few he / hi / th / vi / ja / zh / ko words. The film's own words are always kept as written; nothing here is shown on screen.

export const LANGS = ['en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'sr', 'ru', 'uk', 'el', 'ar', 'he', 'ja', 'zh', 'ko', 'hi', 'th', 'vi'];

const T = (s) => s.split('|').map((w) => w.trim()).filter(Boolean);

/** Calls to action: the verb (or set phrase) a call to action starts with. */
export const CTA = {
  en: T('book|book now|visit|order|order now|call|try|start|sign up|signup|join|shop now|shop|get yours|get|download|dm|message|text|reserve|grab|claim|subscribe|register|apply|contact|buy|come in|come|stop by|swing by|follow|rsvp|walk in|drop by|pre-order|preorder|watch|see|find us|learn|open house|pop in|head over|tap|reserve now'),
  es: T('ven|venid|vengan|visítanos|visitanos|visítenos|reserva|reserve|reservá|llama|llámanos|llamanos|pide|pídelo|ordena|compra|agenda|agende|escríbenos|escribenos|apúntate|apuntate|inscríbete|descubre|aprovecha|pasa|pásate|no te lo pierdas'),
  pt: T('agende|agenda|marque|reserve|venha|venham|visite|ligue|peça|peca|compre|garanta|chame|inscreva-se|aproveite|passe|confira|experimente|fale conosco|chama no direct'),
  fr: T('venez|viens|réservez|reservez|réserve|appelez|appelle|commandez|commande|passez|découvrez|decouvrez|profitez|inscrivez-vous|rejoignez|essayez|achetez|contactez|prenez rendez-vous'),
  de: T('komm|kommt|komm vorbei|kommen sie|vorbeikommen|besuchen sie|besucht uns|buchen|buche|buchen sie|jetzt buchen|bestellen|bestelle|bestellen sie|reservieren|reserviere|ruf an|rufen sie an|anrufen|sichern|sichere dir|melde dich an|anmelden|probier|probieren sie|schau vorbei|termin vereinbaren'),
  it: T('prenota|prenotate|vieni|venite|chiama|chiamaci|ordina|ordinate|scopri|passa|passate|iscriviti|approfitta|prova|acquista|contattaci'),
  nl: T('boek|bestel|kom|kom langs|bel|reserveer|bezoek|schrijf je in|maak een afspraak|probeer|koop|ontdek|meld je aan'),
  pl: T('zapisz się|zapisz sie|zarezerwuj|zamów|zamow|przyjdź|przyjdz|przyjdźcie|odwiedź|odwiedz|zadzwoń|zadzwon|wpadnij|wpadnijcie|kup|umów się|umow sie|sprawdź|sprawdz|dołącz|dolacz|skorzystaj'),
  tr: T('gel|gelin|hemen gel|ara|arayın|arayin|sipariş ver|siparis ver|rezervasyon yap|randevu al|kayıt ol|kayit ol|ziyaret edin|uğrayın|ugrayin|uğra|katıl|katil|dene|satın al|kaçırma|kacirma'),
  sr: T('dođite|dodjite|dođi|dodji|pozovite|pozovi|rezervišite|rezervisite|rezerviši|rezervisi|zakažite|zakazite|zakaži|zakazi|posetite|posjetite|naručite|narucite|naruči|naruci|svratite|svrati|kupite|kupi|prijavite se|javite se|pišite|pisite'
    + '|дођите|дођи|позовите|позови|резервишите|резервиши|закажите|закажи|посетите|посјетите|наручите|наручи|свратите|сврати|купите|купи|пријавите се|јавите се|пишите'),
  ru: T('запишись|запишитесь|приходи|приходите|звони|звоните|позвоните|закажи|закажите|бронируй|бронируйте|забронируйте|заходи|заходите|купи|купите|успей|успейте|пишите|попробуй|попробуйте|присоединяйтесь'),
  uk: T('приходьте|приходь|запишіться|запишись|телефонуйте|дзвоніть|замовляйте|замовте|завітайте|бронюйте|купуйте|пишіть|спробуйте'),
  el: T('έλα|ελα|ελάτε|ελατε|κλείσε|κλείστε|κλειστε|κάλεσε|καλέστε|καλεστε|παράγγειλε|παραγγείλτε|επισκεφθείτε|επισκεφτείτε|κάνε κράτηση|κάντε κράτηση|δοκίμασε|δοκιμάστε|αγόρασε'),
  ar: T('زورونا|زوروا|زرنا|تعال|تعالوا|اتصل|اتصلوا|اطلب|اطلبوا|احجز|احجزوا|سجل|سجلوا|اشتر|اشترِ|تفضلوا|جرب|جربوا|لا تفوت|لا تفوتوا|تواصلوا'),
  he: T('בואו|בוא|הזמינו|הזמן|התקשרו|קנו|הירשמו|הצטרפו|נסו'),
  hi: T('आएं|आइए|आज ही आएं|ऑर्डर करें|बुक करें|कॉल करें|खरीदें'), th: T('แวะมา|แวะมาเลย|สั่งเลย|จองเลย|โทรเลย'), vi: T('ghé|ghé ngay|đặt ngay|gọi ngay|mua ngay|đến ngay'),
  ja: T('今すぐ|ご来店|来店|ご予約|予約|お問い合わせ|お試し|チェック'),
  zh: T('立即|马上|預約|预约|欢迎光临|歡迎光臨|快来|快來|下单|下單'),
  ko: T('지금|예약|방문|주문|문의|신청'),
};

/** Words that may stand just before the verb and belong to the call to action ("Jetzt vorbeikommen", "Hemen gel"). */
export const CTA_LEAD = {
  en: T('now|today|just'), es: T('ya|hoy|ahora'), pt: T('já|ja|agora|hoje'), fr: T('maintenant|vite'), de: T('jetzt|heute|gleich'),
  it: T('ora|subito|oggi'), nl: T('nu|vandaag'), pl: T('teraz|już|juz|dziś|dzis'), tr: T('hemen|şimdi|simdi|bugün|bugun'),
  sr: T('odmah|sada|danas|одмах|сада|данас'), ru: T('сейчас|сегодня|скорее'), uk: T('зараз|сьогодні'), el: T('τώρα|σήμερα'), ar: T('الآن|اليوم'),
};

/** "now / today / tonight": a call to action that ends on one of these gets an "!" in the post. */
export const NOW_WORDS = {
  en: T('today|now|tonight|today only'), es: T('hoy|ahora|ya|esta noche'), pt: T('hoje|agora|já|ja'), fr: T("aujourd'hui|maintenant|ce soir"),
  de: T('heute|jetzt|heute abend'), it: T('oggi|ora|subito|stasera'), nl: T('vandaag|nu|vanavond'), pl: T('dziś|dzisiaj|teraz|już'),
  tr: T('bugün|şimdi|hemen|bu akşam'), sr: T('danas|sada|odmah|večeras|данас|сада|одмах|вечерас'), ru: T('сегодня|сейчас'), uk: T('сьогодні|зараз'),
  el: T('σήμερα|τώρα|απόψε'), ar: T('اليوم|الآن|الليلة'),
};

/** Discount nouns: written next to a number ("20% off", "скидка 20%", "%20 indirim", "خصم 20٪"). */
export const DISCOUNT = {
  en: T('off|discount|sale|savings'), es: T('descuento|dto|rebaja|rebajas'), pt: T('desconto|off|promoção|promocao'), fr: T('réduction|reduction|remise|de remise|promo|soldes'),
  de: T('rabatt|nachlass|reduziert'), it: T('sconto|di sconto|saldi'), nl: T('korting'), pl: T('rabatu|rabat|zniżki|znizki|zniżka|znizka|taniej|promocja'),
  tr: T('indirim|indirimli'), sr: T('popusta|popust|sniženje|snizenje|akcija|попуста|попуст|снижење|акција'), ru: T('скидка|скидки|скидку|акция|распродажа'),
  uk: T('знижка|знижки|акція|розпродаж'), el: T('έκπτωση|εκπτωση|εκπτώσεις|προσφορά'), ar: T('خصم|تخفيض|تخفيضات|عرض'), he: T('הנחה|מבצע'), hi: T('छूट|सेल'), th: T('ลด|ส่วนลด'), vi: T('giảm|giảm giá|khuyến mãi'),
  ja: T('割引|オフ|セール'), zh: T('折|优惠|優惠|特价|特價'), ko: T('할인|세일'),
};

/** "Free" (and gift / on the house). */
export const FREE = {
  en: T('free|on the house'), es: T('gratis|gratuito|gratuita|de regalo'), pt: T('grátis|gratis|gratuito|gratuita|de graça'), fr: T('gratuit|gratuite|offert|offerte'),
  de: T('gratis|kostenlos|umsonst|geschenkt'), it: T('gratis|gratuito|gratuita|in omaggio|omaggio'), nl: T('gratis'), pl: T('gratis|za darmo|darmowy|darmowa|bezpłatny|bezpłatnie|bezplatnie'),
  tr: T('bedava|ücretsiz|ucretsiz|hediye'), sr: T('besplatno|besplatan|besplatna|besplatn|gratis|бесплатно|бесплатан|бесплатна|гратис'), ru: T('бесплатно|бесплатный|бесплатная|в подарок|даром'),
  uk: T('безкоштовно|безкоштовний|у подарунок'), el: T('δωρεάν|δωρεά|δώρο'), ar: T('مجانا|مجاناً|مجاني|مجانية|هدية'), he: T('חינם|מתנה'), hi: T('मुफ़्त|मुफ्त|फ्री'), th: T('ฟรี'), vi: T('miễn phí|tặng'),
  ja: T('無料|タダ'), zh: T('免费|免費|赠送|贈送'), ko: T('무료|공짜'),
};

/** Half price, buy one get one, two for one: deals said in words. */
export const DEAL_PHRASES = {
  en: T('half price|half off|two for one|buy one get one|buy one, get one|buy one get one free|bogo|happy hour|today only|limited time|last chance'),
  es: T('mitad de precio|dos por uno|solo hoy|última oportunidad'), pt: T('metade do preço|leve 2 pague 1|leve dois pague um|só hoje|so hoje'), fr: T('moitié prix|deux pour un|un acheté un offert|aujourd’hui seulement'),
  de: T('halber preis|zum halben preis|zwei für eins|nur heute'), it: T('metà prezzo|meta prezzo|prendi 2 paghi 1|solo oggi'), nl: T('halve prijs|twee halen één betalen|1 + 1 gratis|alleen vandaag'),
  pl: T('pół ceny|pol ceny|dwa w cenie jednego|tylko dziś'), tr: T('yarı fiyat|yari fiyat|bir alana bir bedava|sadece bugün'), sr: T('pola cene|pola cijene|samo danas|пола цене|само данас'),
  ru: T('полцены|за полцены|только сегодня|два по цене одного'), uk: T('пів ціни|лише сьогодні'), el: T('μισή τιμή|μόνο σήμερα'), ar: T('نصف السعر|اليوم فقط|اشتر واحد واحصل على الثاني'),
  ja: T('半額|本日限り|期間限定'), zh: T('半价|半價|买一送一|買一送一|限时|限時'), ko: T('반값|1+1|오늘만'),
};

/** Other offer words (they make a line the offer, but are not a deal by themselves). */
export const OFFER_WORDS = {
  en: T('deal|offer|special|promo|coupon|trial|sale'), es: T('oferta|promoción|promocion|promo|especial'), pt: T('oferta|promoção|promocao|promo'), fr: T('offre|promotion|promo|spécial'),
  de: T('angebot|aktion|sonderangebot'), it: T('offerta|promozione|promo'), nl: T('aanbieding|actie'), pl: T('oferta|promocja|okazja'), tr: T('kampanya|fırsat|firsat'),
  sr: T('akcija|ponuda|акција|понуда'), ru: T('акция|предложение'), uk: T('акція|пропозиція'), el: T('προσφορά|προσφορές'), ar: T('عرض|عروض'), he: T('מבצע'),
  ja: T('キャンペーン|特価'), zh: T('活动|活動|特惠'), ko: T('이벤트|특가'),
};

/** "for" / "x" between two numbers: "2 for 1", "2x1", "2 por 1", "2 für 1", "2 za 1", "1+1". */
export const NUM_FOR = T('for|x|×|por|pour|für|fur|per|voor|za|за|için|по цене|για|по|al prezzo di');

/** Business nouns, by trade: a word that makes "Barbearia do Zé" or "Фризерски салон Луна" a shop name. */
export const BUSINESS = {
  beauty: T('barbershop|barber|barbers|salon|spa|studio|nails|tattoo|beauty|lashes|brows|frizer|frizerski|frizerka|frizerski salon|berbernica|brijačnica|kozmetički salon|peluquería|peluqueria|barbería|barberia|estética|estetica|barbearia|salão|salao|cabeleireiro|coiffeur|coiffure|salon de coiffure|friseur|friseursalon|parrucchiere|barbiere|estetista|kapsalon|kapper|barbier|nagelstudio|fryzjer|salon fryzjerski|barber shop|kuaför|kuafor|berber|güzellik salonu'
    + '|фризер|фризерски|фризерски салон|салон|барбершоп|барбер|парикмахерская|салон красоты|перукарня|κομμωτήριο|κουρείο|σαλόνι|صالون|حلاق|صالون تجميل|מספרה|सैलून|ร้านตัดผม|サロン|美容室|理容室|发廊|美发|理发店|미용실|바버샵'),
  food: T('café|cafe|caffè|caffe|coffee|coffee shop|coffee house|kafić|kafic|kafana|kafeterija|bakery|bar|bistro|restaurant|pizzeria|pizza|kitchen|grill|pub|deli|diner|brasserie|trattoria|osteria|panadería|panaderia|pastelería|pastelería|cafetería|cafeteria|restaurante|padaria|lanchonete|boulangerie|pâtisserie|patisserie|bäckerei|backerei|konditorei|gasthaus|bakkerij|eetcafé|piekarnia|kawiarnia|restauracja|pizzeria|kahve|kahvesi|kafe|fırın|firin|lokanta|pastane|pekara|pekarа|poslastičarnica|restoran|picerija'
    + '|кафе|кофейня|пекарня|ресторан|пиццерия|бар|кафана|пекара|посластичарница|ресторан|пицерија|кав\'ярня|καφέ|καφετέρια|φούρνος|εστιατόριο|ταβέρνα|μπαρ|مقهى|كافيه|مخبز|مطعم|בית קפה|קפה|कैफ़े|कैफे|स्वीट्स|मिठाई|ढाबा|रेस्टोरेंट|ร้านกาแฟ|คาเฟ่|ร้านอาหาร|เบเกอรี่|quán|quán phở|quán cà phê|tiệm bánh|nhà hàng|카페|מאפייה|מסעדה|カフェ|喫茶|ベーカリー|パン屋|レストラン|咖啡|咖啡店|餐厅|餐廳|面包店|카페|베이커리|식당'),
  fitness: T('gym|fitness|yoga|pilates|crossfit|boxing|club|teretana|gimnasio|academia|salle de sport|fitnessstudio|palestra|sportschool|siłownia|silownia|spor salonu|фитнес|спортзал|тренажерный зал|теретана|γυμναστήριο|نادي|صالة رياضية|חדר כושר|ジム|健身房|헬스장'),
  retail: T('shop|store|boutique|market|florist|bookstore|outlet|tienda|loja|boutique|magasin|laden|geschäft|negozio|winkel|sklep|mağaza|magaza|dükkan|prodavnica|butik|магазин|продавница|бутик|κατάστημα|μαγαζί|متجر|محل|חנות|दुकान|ร้าน|ショップ|店|商店|가게'),
  realestate: T('realty|homes|properties|real estate|inmobiliaria|imobiliária|imobiliaria|immobilier|agence immobilière|immobilien|immobiliare|makelaar|nieruchomości|emlak|nekretnine|недвижимость|некретнине|ακίνητα|عقارات|נדל"ן|不動産|房地产|부동산'),
  general: T('clinic|dental|agency|academy|school|garage|motors|hotel|hostel|co.|company|labs|lab|clínica|clinica|escuela|escola|école|schule|scuola|klinik|klinika|okul|škola|клиника|школа|клиника|κλινική|σχολή|عيادة|مدرسة|فندق|クリニック|学校|ホテル'),
};

/** Topic words for the kind of business (more than the shop nouns: "fades", "croissants", "pints"). */
export const TOPIC_WORDS = {
  beauty: T('fade|fades|haircut|haircuts|hair|beard|shave|massage|facial|facials|skincare|makeup|make-up|manicure|pedicure|corte|barba|cabello|cabelo|coupe|barbe|haarschnitt|bart|taglio|capelli|knippen|baard|strzyżenie|broda|saç|sakal|tıraş|šišanje|sisanje|brijanje|frizura|kosa|стрижка|борода|бритье|шишање|бријање|фризура|коса|κούρεμα|μαλλιά|γένια|قص الشعر|حلاقة|شعر|תספורת'),
  food: T('coffee|espresso|latte|cappuccino|flat white|cold brew|croissant|croissants|pastry|pastries|bread|cake|cakes|dessert|brunch|breakfast|lunch|dinner|menu|burger|burgers|sushi|tacos|pizza|slice|slices|wine|beer|pints|pint|cocktail|cocktails|quiz|food|soda|café|pan|pain|brot|brötchen|pane|brood|chleb|ekmek|hleb|kafa|kava|kawa|kahve|kaffee|koffie|caffè|kafe|viennoiseries|viennoiserie|pâtisseries|croissants|cornetto|cornetti|tapas|cerveza|cerveja|bière|bier|birra|piwo|bira|pivo'
    + '|кофе|кафа|кава|хлеб|хлеб|торта|пиво|завтрак|обед|ужин|καφές|καφέ|ψωμί|γλυκά|μπίρα|πρωινό|قهوة|خبز|حلويات|فطور|ラテ|コーヒー|パン|ケーキ|咖啡|拿铁|面包|커피|라떼|빵'),
  fitness: T('workout|workouts|training|trainer|trainers|classes|membership|entrenamiento|treino|entraînement|training|allenamento|trening|antrenman|тренировка|тренинг|προπόνηση|تمارين|אימון'),
  realestate: T('open house|listing|bedroom|bedrooms|bed|beds|bath|baths|sq ft|apartment|apartments|condo|villa|for sale|for rent|piso|apartamento|casa|appartement|wohnung|appartamento|woning|mieszkanie|daire|stan|квартира|стан|διαμέρισμα|شقة|דירה'),
  retail: T('clothing|fashion|shoes|sneakers|jewelry|jewellery|gifts|gift|flowers|collection|ropa|roupa|vêtements|kleidung|abbigliamento|kleding|odzież|giyim|odeća|одежда|одећа|ρούχα|ملابس|בגדים'),
  event: T('event|events|concert|festival|meetup|workshop|webinar|conference|party|tickets|live music|evento|concierto|fiesta|concerto|festa|événement|soirée|veranstaltung|konzert|feest|wydarzenie|koncert|etkinlik|konser|događaj|koncert|журка|событие|концерт|вечеринка|догађај|εκδήλωση|συναυλία|حفلة|فعالية|מסיבה'),
};

/** Linking words: a beat may not start with one, a cut may not end on one. */
export const CONNECTORS = {
  en: T('in|for|at|on|after|before|with|without|to|of|and|or|nor|but|from|by|until|till|near|into|onto|over|under|about|than|as|so|&|+'),
  es: T('en|de|del|para|con|por|y|o|al|sin|desde|hasta'), pt: T('em|no|na|nos|nas|de|do|da|dos|das|para|com|por|e|ou|ao|sem|até'),
  fr: T('et|pour|avec|au|aux|du|des|à|en|sur|dans|de|ou|sans|par|chez'), de: T('mit|für|und|bei|im|am|zum|zur|ab|bis|von|vor|nach|in|an|auf|oder|ohne|aus'),
  it: T('per|di|da|e|nel|nella|alla|al|con|su|in|o|senza|dal'), nl: T('in|op|met|voor|en|of|van|bij|tot|naar|zonder|aan'),
  pl: T('w|we|na|z|ze|do|i|oraz|lub|dla|od|po|przy|bez|o'), tr: T('ve|ile|için|veya|ya da'), sr: T('u|na|za|i|od|do|sa|s|po|pre|posle|prije|poslije|iz|kod|uz|ka|у|на|за|и|од|до|са|с|по|пре|после|из|код|уз|ка'),
  ru: T('в|во|на|за|и|от|до|с|со|по|для|из|у|к|при|без|или'), uk: T('в|у|на|за|і|й|від|до|з|по|для|із|при|без|або'),
  el: T('σε|στο|στη|στην|στον|στα|για|με|και|από|ή|χωρίς|ως'), ar: T('في|على|مع|من|إلى|الى|و|أو|عن|حتى|ب'),
};
/** Articles and determiners: a cut may not end on one either ("…the"). */
export const ARTICLES = {
  en: T('the|a|an|your|our|my|their|this|these|that|who|which|is|are|was|we|you|they|i|it|he|she'), es: T('el|la|los|las|un|una|este|esta|su|tu|nuestro'),
  pt: T('o|a|os|as|um|uma|este|esta|seu|sua'), fr: T('le|la|les|l’|un|une|ce|cette|ces|votre|notre'), de: T('der|die|das|den|dem|ein|eine|einen|diese|dieser|ihr|unser'),
  it: T('il|lo|la|i|gli|le|un|una|questo|questa'), nl: T('de|het|een|deze|dit|jouw|onze'), pl: T('ten|ta|to|ci|te|wasz|nasz'), tr: T('bu|şu|bir'),
  sr: T('ovaj|ova|ovo|taj|ta|to|ваш|овај|ова|ово|тај|та|то'), ru: T('этот|эта|это|эти|ваш|наш'), el: T('ο|η|το|οι|τα|τον|την|των|ένα|μια'), ar: T('هذا|هذه'),
};
/** Joining words inside a name: "Maple and Rye", "Barbearia do Zé", "Café des Amis", "Pizzeria Da Mario". */
export const NAME_JOIN = T("and|&|of|the|de|la|le|les|du|des|del|della|di|da|do|dos|das|y|und|et|e|i|von|van|der|den|het|al|el|'n|и|і|και|τα|του|της|ve");

/** Days of the week (a day is not a place, and a button may drop "this" / "next" before it). */
export const WEEKDAYS = {
  en: T('monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend'), es: T('lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|fin de semana'),
  pt: T('segunda|segunda-feira|terça|terca|terça-feira|quarta|quarta-feira|quinta|quinta-feira|sexta|sexta-feira|sábado|sabado|domingo|fim de semana'),
  fr: T('lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|week-end|weekend'), de: T('montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|wochenende'),
  it: T('lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|fine settimana|weekend'),
  nl: T('maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|weekend'), pl: T('poniedziałek|wtorek|środa|sroda|czwartek|piątek|piatek|sobota|niedziela|weekend|w sobotę|w piątek'),
  tr: T('pazartesi|salı|sali|çarşamba|carsamba|perşembe|persembe|cuma|cumartesi|pazar|hafta sonu'),
  sr: T('ponedeljak|ponedjeljak|utorak|sreda|srijeda|četvrtak|cetvrtak|petak|subota|nedelja|nedjelja|vikend|понедељак|уторак|среда|четвртак|петак|субота|недеља|викенд'),
  ru: T('понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье|выходные'), uk: T('понеділок|вівторок|середа|четвер|пʼятниця|пятниця|субота|неділя|вихідні'),
  el: T('δευτέρα|τρίτη|τετάρτη|πέμπτη|παρασκευή|σάββατο|σαββατο|κυριακή|σαββατοκύριακο'), ar: T('الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت|الأحد|نهاية الأسبوع'),
  he: T('ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת'), ja: T('月曜|火曜|水曜|木曜|金曜|土曜|日曜|週末'), zh: T('周一|周二|周三|周四|周五|周六|周日|周末|週末|星期'), ko: T('월요일|화요일|수요일|목요일|금요일|토요일|일요일|주말'),
};

/** Currency marks, written before or after the amount: $5, 10€, €10, R$45, 45 zł, CHF 12, 1.299,00 din. */
export const CURRENCIES = ['R$', 'US$', 'A$', 'C$', 'NZ$', 'HK$', 'S$', 'MX$', '$', '€', '£', '¥', '₹', '₩', '₺', '₽', '₴', '₪', '₫', '฿', '₱', '₦', '₵', '₸', '₼', '₾', 'zł', 'kr', 'Kč', 'Ft', 'lei', 'лв', 'CHF', 'din', 'дин', 'RSD', 'KM', 'kn', 'AED', 'SAR', 'QAR', 'EGP', 'د.إ', 'ر.س', 'ج.م', 'درهم', 'ريال', 'جنيه', 'руб', 'грн', 'TL', 'USD', 'EUR', 'GBP', '円', '元', '원', 'Rs', 'R'];

export const PLATFORM_PHRASES = { en: { linkInBio: 'Link in bio' }, es: { linkInBio: 'Enlace en la bio' }, pt: { linkInBio: 'Link na bio' }, fr: { linkInBio: 'Lien dans la bio' }, de: { linkInBio: 'Link in der Bio' }, it: { linkInBio: 'Link in bio' } };

// ---------- builders ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const flat = (table, langs) => [...new Set((langs || Object.keys(table)).flatMap((k) => table[k] || []))];
/** A regex source matching any of the words as a whole word (CJK entries match anywhere), longest first. */
export function alt(words) {
  const ws = [...new Set(words)].sort((a, b) => b.length - a.length);
  const body = ws.map((w) => esc(w).replace(/\s+/g, '\\s+')).join('|');
  return `(?:${body})`;
}
/** Unicode word boundaries (JavaScript's \b only knows A–Z): a word starts and ends where letters stop. */
export const L0 = '(?<![\\p{L}\\p{M}\\p{N}])', L1 = '(?![\\p{L}\\p{M}\\p{N}])';
/** Whole-word matcher for a list (CJK words need no boundary). */
export function wordsRe(words, flags = 'iu') {
  const cjk = words.filter((w) => CJK.test(w)), rest = words.filter((w) => !CJK.test(w));
  const parts = [];
  if (rest.length) parts.push(`${L0}${alt(rest)}${L1}`);
  if (cjk.length) parts.push(alt(cjk));
  return new RegExp(parts.join('|') || '(?!)', flags);
}
export const all = (table) => flat(table);

// ---------- numbers and money ----------
/** Any decimal digit (Arabic-Indic ٠–٩ and Persian ۰–۹ too). */
export const D = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9\\uFF10-\\uFF19]';
/** 1.299,00 · 1,299.00 · 1 299 · 45 · 4,5 */
export const NUM = `${D}{1,3}(?:[.,\\u00a0\\u202f ']${D}{3})+(?:[.,]${D}{1,2})?(?!${D})|${D}+(?:[.,]${D}{1,2})?`;
export const PCT = '[%٪﹪％]';
/** A currency mark; letter codes ("kr", "Rs", "din", "درهم") only as a word of their own, so "Chairs 10" is not rupees. */
const isWordCur = (c) => /^[\p{L}.]+$/u.test(c);
export const CUR_SRC = `(?:${L0}${alt(CURRENCIES.filter((c) => isWordCur(c) && c.length > 1))}|${alt(CURRENCIES.filter((c) => !isWordCur(c)))})`;
const CUR_ALT = CUR_SRC; // a bare "R" only counts as a prefix glued to the figure (R45, South Africa)
/** A price: "$5", "€10", "10€", "10 €", "R$45", "45 zł", "CHF 12", "12 CHF", "1.299,00 din", "R45". */
export const PRICE_RE = new RegExp(`(?:${CUR_ALT}|R(?=${D}))\\s?(?:${NUM})(?:\\s?[-–]\\s?(?:${NUM}))?|(?:${NUM})\\s?${CUR_ALT}${L1}`, 'u');
/** Western digits for any decimal digit. */
export const asciiDigits = (s) => String(s).replace(/[\u0660-\u0669]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, (d) => d.charCodeAt(0) - 0x6F0).replace(/[\uFF10-\uFF19]/g, (d) => d.charCodeAt(0) - 0xFF10);
/** Read "1.299,00", "1,299.00", "1 299", "4,5", "12.5" as a number (the last separator before 1–2 digits is the decimal mark). */
export function parseAmount(s) {
  let t = asciiDigits(s).replace(/[\u00a0\u202f ']/g, '');
  const lastDot = t.lastIndexOf('.'), lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) { const dec = lastDot > lastComma ? '.' : ','; t = t.split(dec === '.' ? ',' : '.').join(''); if (dec === ',') t = t.replace(',', '.'); }
  else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',', parts = t.split(sep);
    if (parts.length > 2 || (parts[1] && parts[1].length === 3)) t = parts.join(''); // 1.299 / 1,299 / 1.000.000 → thousands
    else t = parts.join('.');
  }
  return Number(t);
}

// ---------- which language is this ----------
const SCRIPT_LANG = [[/[\u0600-\u06FF\u0750-\u077F]/u, 'ar'], [/[\u0590-\u05FF]/u, 'he'], [/[\u3040-\u30FF]/u, 'ja'], [/[\uAC00-\uD7A3]/u, 'ko'], [/\p{Script=Han}/u, 'zh'],
  [/[\u0E00-\u0E7F]/u, 'th'], [/[\u0900-\u097F]/u, 'hi'], [/\p{Script=Greek}/u, 'el']];
const LATIN_HINTS = {
  es: /[ñ¿¡]|\b(el|los|las|en|para|con|hoy|ven|este|esta|sábado|por)\b/giu, pt: /[ãõ]|\b(do|da|dos|das|com|para|já|hoje|venha|agende|não)\b/giu,
  fr: /[œ]|\b(le|les|des|du|sur|ce|avec|pour|venez|nous|est)\b/giu, de: /[ß]|\b(der|die|das|und|mit|für|am|im|jetzt|zum|nur)\b|[äöü]/giu,
  it: /\b(il|della|di|per|con|ora|sconto|prenota|vieni|oggi)\b|[àèìòù]\b/giu, nl: /\b(het|een|deze|nu|korting|voor|met|bij|van)\b|ij/giu,
  pl: /[łąęśźżń]|\b(się|w|na|dla|tydzień|z)\b/giu, tr: /[ığşİ]|\b(ve|ile|için|bir|indirim|hemen)\b/giu, sr: /[čćšžđ]|\b(u|na|za|sa|danas|popust)\b/giu,
  en: /\b(the|and|for|with|now|today|this|your|our|off|free|book|order)\b/giu,
};
/** Best guess at the brief's language (two-letter code). English when nothing else stands out. */
export function detectLang(text) {
  const s = String(text || '');
  if (/\p{Script=Cyrillic}/u.test(s)) return /[ђјљњћџЂЈЉЊЋЏ]/u.test(s) ? 'sr' : /[іїєґІЇЄҐ]/u.test(s) ? 'uk' : 'ru';
  for (const [re, l] of SCRIPT_LANG) if (re.test(s)) return l;
  if (/[ơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/iu.test(s)) return 'vi';
  const lower = s.toLowerCase(); let best = 'en', score = 0;
  for (const [l, re] of Object.entries(LATIN_HINTS)) { const n = (lower.match(new RegExp(re.source.replaceAll('\\b', '(?:(?<![\\p{L}])|(?![\\p{L}]))'), 'giu')) || []).length + (l === 'en' ? 0.5 : 0); if (n > score) { score = n; best = l; } }
  return best;
}
/** Right-to-left scripts. */
export const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;
export const isRtl = (s) => { const m = /[\p{L}]/u.exec(String(s || '')); return !!(m && RTL.test(m[0])); };
