(function initDailyQuotaTicker() {
  const DAILY_LIMIT = 50;
  const REMAINING = 2;
  const NAMES_PER_DAY = 24;

  const appliedEl = document.getElementById("quota-applied-count");
  const remainingEl = document.getElementById("quota-remaining-count");
  const track = document.getElementById("quota-marquee-track");
  if (!appliedEl || !remainingEl || !track) return;

  appliedEl.textContent = String(DAILY_LIMIT - REMAINING);
  remainingEl.textContent = String(REMAINING);

  const FIRST = [
    "Alex", "Emma", "Lukas", "Camille", "Yuki", "Min-jun", "Wei", "Olivia", "Noah", "Lucas",
    "Aarav", "Omar", "Sofia", "Marco", "Lars", "Michelle", "Chen", "Diego", "Thabo", "Ingrid",
    "Henrik", "Priya", "Raj", "Fatima", "Youssef", "Amira", "Ivan", "Nina", "Petra", "Jonas",
    "Elena", "Mateo", "Chiara", "Sven", "Anika", "Ravi", "Hana", "Kenji", "Mei", "Sora",
    "Liam", "Ava", "Ethan", "Mia", "Oliver", "Isabella", "Elijah", "Sophia", "James", "Charlotte",
    "William", "Amelia", "Benjamin", "Harper", "Lucas", "Evelyn", "Henry", "Abigail", "Alexander", "Emily",
    "Daniel", "Elizabeth", "Matthew", "Sofia", "Joseph", "Avery", "David", "Ella", "Samuel", "Scarlett",
    "Jackson", "Grace", "Sebastian", "Chloe", "Jack", "Victoria", "Aiden", "Riley", "Owen", "Aria",
    "Theodore", "Lily", "Caleb", "Aurora", "Ryan", "Zoey", "Nathan", "Penelope", "Thomas", "Layla",
    "Leo", "Nora", "Hugo", "Mila", "Felix", "Hannah", "Oscar", "Leah", "Arthur", "Zoe",
    "Victor", "Stella", "Adrian", "Violet", "Julian", "Hazel", "Max", "Ellie", "Simon", "Nadia",
    "Carlos", "Rosa", "Pablo", "Lucia", "Andre", "Clara", "Bruno", "Helena", "Tomas", "Eva",
    "Marek", "Zofia", "Filip", "Agnieszka", "Dmitri", "Katya", "Arjun", "Ananya", "Vikram", "Kavya",
  ];

  const LAST = [
    "Nguyen", "Kim", "Patel", "Silva", "Garcia", "Müller", "Schmidt", "Dubois", "Martin", "Bernard",
    "Rossi", "Russo", "Ferrari", "Johansson", "Andersson", "Eriksson", "Nielsen", "Hansen", "Olsen", "Kowalski",
    "Nowak", "Wójcik", "Kovács", "Horváth", "Popescu", "Ionescu", "Petrov", "Ivanov", "Smirnov", "Kuznetsov",
    "Cohen", "Levy", "Müller", "Fischer", "Weber", "Wagner", "Becker", "Hoffmann", "Schäfer", "Koch",
    "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White",
    "Harris", "Martin", "Thompson", "Robinson", "Clark", "Lewis", "Walker", "Hall", "Allen", "Young",
    "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Carter", "Mitchell", "Perez",
    "Roberts", "Turner", "Phillips", "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez",
    "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey", "Rivera", "Cooper",
    "Richardson", "Cox", "Howard", "Ward", "Torres", "Peterson", "Gray", "Ramirez", "James", "Watson",
    "Brooks", "Kelly", "Sanders", "Price", "Bennett", "Wood", "Barnes", "Ross", "Henderson", "Coleman",
    "Jenkins", "Perry", "Powell", "Long", "Patterson", "Hughes", "Flores", "Washington", "Butler", "Simmons",
    "Foster", "Gonzales", "Bryant", "Alexander", "Russell", "Griffin", "Diaz", "Hayes", "Myers", "Ford",
    "Hamilton", "Graham", "Sullivan", "Wallace", "Woods", "Cole", "West", "Jordan", "Owens", "Reynolds",
    "Fisher", "Ellis", "Harrison", "Gibson", "McDonald", "Cruz", "Marshall", "Ortiz", "Gomez", "Murray",
  ];

  const CITIES = [
    { flag: "🇺🇸", city: "New York", zh: false },
    { flag: "🇺🇸", city: "San Francisco", zh: false },
    { flag: "🇺🇸", city: "Austin", zh: false },
    { flag: "🇬🇧", city: "London", zh: false },
    { flag: "🇬🇧", city: "Manchester", zh: false },
    { flag: "🇩🇪", city: "Berlin", zh: false },
    { flag: "🇩🇪", city: "Munich", zh: false },
    { flag: "🇫🇷", city: "Paris", zh: false },
    { flag: "🇫🇷", city: "Lyon", zh: false },
    { flag: "🇯🇵", city: "Tokyo", zh: false },
    { flag: "🇯🇵", city: "Osaka", zh: false },
    { flag: "🇰🇷", city: "Seoul", zh: false },
    { flag: "🇸🇬", city: "Singapore", zh: false },
    { flag: "🇦🇺", city: "Sydney", zh: false },
    { flag: "🇦🇺", city: "Melbourne", zh: false },
    { flag: "🇨🇦", city: "Toronto", zh: false },
    { flag: "🇨🇦", city: "Vancouver", zh: false },
    { flag: "🇧🇷", city: "São Paulo", zh: false },
    { flag: "🇮🇳", city: "Mumbai", zh: false },
    { flag: "🇮🇳", city: "Bengaluru", zh: false },
    { flag: "🇦🇪", city: "Dubai", zh: false },
    { flag: "🇪🇸", city: "Madrid", zh: false },
    { flag: "🇮🇹", city: "Milan", zh: false },
    { flag: "🇳🇱", city: "Amsterdam", zh: false },
    { flag: "🇨🇳", city: "上海", zh: true },
    { flag: "🇨🇳", city: "深圳", zh: true },
    { flag: "🇨🇳", city: "北京", zh: true },
    { flag: "🇭🇰", city: "Hong Kong", zh: false },
    { flag: "🇹🇼", city: "Taipei", zh: false },
    { flag: "🇲🇽", city: "Mexico City", zh: false },
    { flag: "🇿🇦", city: "Johannesburg", zh: false },
    { flag: "🇸🇪", city: "Stockholm", zh: false },
    { flag: "🇳🇴", city: "Oslo", zh: false },
    { flag: "🇩🇰", city: "Copenhagen", zh: false },
    { flag: "🇨🇭", city: "Zurich", zh: false },
    { flag: "🇦🇹", city: "Vienna", zh: false },
    { flag: "🇵🇱", city: "Warsaw", zh: false },
    { flag: "🇵🇹", city: "Lisbon", zh: false },
    { flag: "🇮🇪", city: "Dublin", zh: false },
    { flag: "🇹🇷", city: "Istanbul", zh: false },
    { flag: "🇸🇦", city: "Riyadh", zh: false },
    { flag: "🇮🇱", city: "Tel Aviv", zh: false },
    { flag: "🇹🇭", city: "Bangkok", zh: false },
    { flag: "🇻🇳", city: "Ho Chi Minh City", zh: false },
    { flag: "🇵🇭", city: "Manila", zh: false },
    { flag: "🇮🇩", city: "Jakarta", zh: false },
    { flag: "🇲🇾", city: "Kuala Lumpur", zh: false },
    { flag: "🇳🇿", city: "Auckland", zh: false },
    { flag: "🇦🇷", city: "Buenos Aires", zh: false },
    { flag: "🇨🇱", city: "Santiago", zh: false },
    { flag: "🇨🇴", city: "Bogotá", zh: false },
  ];

  const CN_GIVEN = [
    "子涵", "梓轩", "雨桐", "浩然", "欣怡", "俊杰", "思远", "嘉怡", "博文", "晓彤",
    "明辉", "佳宁", "宇航", "诗涵", "天佑", "雅婷", "建国", "丽华", "志强", "秀英",
  ];

  const CN_FAMILY = [
    "王", "李", "张", "刘", "陈", "杨", "黄", "赵", "周", "吴",
    "徐", "孙", "马", "朱", "胡", "郭", "何", "林", "罗", "高",
  ];

  const COMBO_SPACE = FIRST.length * LAST.length * CITIES.length;

  function utcDayIndex() {
    return Math.floor(Date.now() / 86400000);
  }

  /** Unique applicant line per global index — never reused across days. */
  function applicantLine(globalIndex) {
    const safe = ((globalIndex % COMBO_SPACE) + COMBO_SPACE) % COMBO_SPACE;
    const cityIdx = safe % CITIES.length;
    const rest = Math.floor(safe / CITIES.length);
    const firstIdx = rest % FIRST.length;
    const lastIdx = Math.floor(rest / FIRST.length) % LAST.length;

    const city = CITIES[cityIdx];
    const first = FIRST[firstIdx];
    const last = LAST[lastIdx];

    if (city.zh) {
      const g = CN_GIVEN[(firstIdx + lastIdx) % CN_GIVEN.length];
      const f = CN_FAMILY[(firstIdx + cityIdx) % CN_FAMILY.length];
      return `${city.flag} ${f}${g} · ${city.city} 刚刚申请`;
    }

    return `${city.flag} ${first} ${last} · ${city.city} just applied`;
  }

  const dayIdx = utcDayIndex();
  const startIndex = dayIdx * NAMES_PER_DAY;
  const applicants = [];
  const seen = new Set();

  for (let i = 0; i < NAMES_PER_DAY; i++) {
    let line = applicantLine(startIndex + i);
    let bump = 0;
    while (seen.has(line) && bump < 1000) {
      line = applicantLine(startIndex + i + bump * NAMES_PER_DAY);
      bump++;
    }
    seen.add(line);
    applicants.push(line);
  }

  const items = [...applicants, ...applicants];
  track.innerHTML = items.map((t) => `<span class="quota-marquee-item">${t}</span>`).join("");

  function adjustQuotaStackOffset() {
    if (!document.body.classList.contains("has-quota-banner")) return;
    const banner = document.getElementById("daily-quota-banner");
    const bars = document.getElementById("top-bars");
    if (!banner) return;
    const h = banner.offsetHeight + (bars ? bars.offsetHeight : 0);
    document.documentElement.style.setProperty("--quota-stack-offset", `${h}px`);
  }

  adjustQuotaStackOffset();
  window.addEventListener("resize", adjustQuotaStackOffset);
})();
