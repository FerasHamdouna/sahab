import type { Condition, Lang } from '../data/types';

export interface Strings {
  brand: string; searchPh: string; searchLbl: string;
  myLoc: string; yourLoc: string; recent: string; results: string; searching: string;
  noRes: (q: string) => string;
  makeHome: string; isHome: string;
  localTime: string; demo: string;
  feels: string; hi: string; lo: string;
  wind: string; gusts: string; from: string;
  humidity: string; dew: string; comfort: [string, string, string, string];
  hourly: string; now: string; daily: string; today: string; tomorrow: string; sunrise: string; sunset: string;
  onbTitle: string; onbBody: string; useLoc: string; pickCity: string; later: string;
  locating: string; locatingBody: string;
  deniedTitle: string; denied: string; geoFailTitle: string; geoFail: string;
  errTitle: string; err: string; retry: string; dismiss: string;
  soundOn: string; soundOff: string; soundPending: string;
  langBtn: string; langLbl: string; unitsLbl: string;
  kmh: string; mph: string;
  dirs: string[]; compass: [string, string, string, string];
  cond: Record<Condition, string>;
  locale: string;
  noWebgl: string;
}

export const STRINGS: Record<Lang, Strings> = {
  ar: {
    brand: 'سحاب', searchPh: 'ابحث عن مدينة…', searchLbl: 'ابحث عن مدينة',
    myLoc: 'موقعي', yourLoc: 'موقعك الحالي', recent: 'عمليات بحث سابقة', results: 'مدن', searching: 'جاري البحث…',
    noRes: (q) => `ما لقينا مدينة باسم «${q}». جرّب اسم ثاني أو اكتبه بالإنجليزي.`,
    makeHome: 'اجعلها مدينتي', isHome: 'مدينتي',
    localTime: 'الساعة هناك', demo: 'بيانات تجريبية',
    feels: 'الإحساس', hi: 'العليا', lo: 'الدنيا',
    wind: 'الرياح', gusts: 'هبّات حتى', from: 'رياح',
    humidity: 'الرطوبة', dew: 'نقطة الندى', comfort: ['جافة', 'مريحة', 'رطبة', 'رطبة جداً'],
    hourly: 'الـ 24 ساعة القادمة', now: 'الآن', daily: 'الأيام السبعة القادمة',
    today: 'اليوم', tomorrow: 'غداً', sunrise: 'شروق', sunset: 'غروب',
    onbTitle: 'بدك تشوف طقس مكانك؟', onbBody: 'منستخدم موقعك بس عشان نجيب الطقس، وما منحفظه عندنا.',
    useLoc: 'استخدم موقعي', pickCity: 'اختار مدينتي', later: 'لاحقاً',
    locating: 'جاري تحديد موقعك…', locatingBody: 'المتصفح ممكن يسألك عن الإذن.',
    deniedTitle: 'ما قدرنا نوصل لموقعك',
    denied: 'الإذن مرفوض. ابحث عن مدينتك واضغط «اجعلها مدينتي»، وبتفتح عليها كل مرة.',
    geoFailTitle: 'ما قدرنا نحدد موقعك', geoFail: 'خلصت المهلة أو الموقع مش متاح هلأ. جرّب كمان مرة أو ابحث عن مدينتك.',
    errTitle: 'ما قدرنا نجيب الطقس هلأ', err: 'تأكد من الاتصال بالإنترنت وجرّب كمان مرة. منعرض آخر بيانات وصلتنا.',
    retry: 'أعد المحاولة', dismiss: 'إغلاق',
    soundOn: 'كتم الأصوات المحيطة', soundOff: 'تشغيل الأصوات المحيطة', soundPending: 'الأصوات تشتغل مع أول نقرة على الصفحة',
    langBtn: 'EN', langLbl: 'Switch to English', unitsLbl: 'وحدة الحرارة',
    kmh: 'كم/س', mph: 'ميل/س',
    dirs: ['شمالية', 'شمالية شرقية', 'شرقية', 'جنوبية شرقية', 'جنوبية', 'جنوبية غربية', 'غربية', 'شمالية غربية'],
    compass: ['ش', 'ق', 'ج', 'غ'],
    cond: { clear: 'صافٍ', partly: 'غائم جزئياً', overcast: 'غائم', fog: 'ضباب', drizzle: 'رذاذ', rain: 'ماطر', snow: 'ثلج', storm: 'عاصفة رعدية' },
    locale: 'ar-u-nu-latn',
    noWebgl: 'متصفحك ما بيدعم الرسوم ثلاثية الأبعاد، فبنعرض خلفية بسيطة.',
  },
  en: {
    brand: 'Sahab', searchPh: 'Search for a city…', searchLbl: 'Search for a city',
    myLoc: 'My location', yourLoc: 'Your location', recent: 'Recent searches', results: 'Cities', searching: 'Searching…',
    noRes: (q) => `No city called “${q}”. Try another spelling or the Arabic name.`,
    makeHome: 'Set as my city', isHome: 'My city',
    localTime: 'Local time', demo: 'Demo data',
    feels: 'Feels like', hi: 'H', lo: 'L',
    wind: 'Wind', gusts: 'Gusts up to', from: 'From the',
    humidity: 'Humidity', dew: 'Dew point', comfort: ['Dry', 'Comfortable', 'Humid', 'Very humid'],
    hourly: 'Next 24 hours', now: 'Now', daily: 'Next 7 days',
    today: 'Today', tomorrow: 'Tomorrow', sunrise: 'Sunrise', sunset: 'Sunset',
    onbTitle: 'Want the weather where you are?', onbBody: 'We only use your location to fetch the weather, and we never store it.',
    useLoc: 'Use my location', pickCity: 'Choose my city', later: 'Later',
    locating: 'Finding your location…', locatingBody: 'Your browser may ask for permission.',
    deniedTitle: "We couldn't get your location",
    denied: 'Location access is off. Search for your city and tap “Set as my city” to open on it every time.',
    geoFailTitle: "We couldn't find your location", geoFail: 'It timed out or location is unavailable right now. Try again or search for your city.',
    errTitle: "We couldn't load the weather", err: 'Check your internet connection and try again. You’re seeing the last data we received.',
    retry: 'Try again', dismiss: 'Dismiss',
    soundOn: 'Mute ambient sound', soundOff: 'Turn ambient sound on', soundPending: 'Ambient sound starts on your first tap',
    langBtn: 'ع', langLbl: 'التبديل للعربية', unitsLbl: 'Temperature unit',
    kmh: 'km/h', mph: 'mph',
    dirs: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'],
    compass: ['N', 'E', 'S', 'W'],
    cond: { clear: 'Clear', partly: 'Partly cloudy', overcast: 'Overcast', fog: 'Fog', drizzle: 'Drizzle', rain: 'Rain', snow: 'Snow', storm: 'Thunderstorm' },
    locale: 'en-GB',
    noWebgl: "Your browser doesn't support 3D graphics, so we're showing a simple background.",
  },
};
