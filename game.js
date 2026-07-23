// ==========================================
// 0. HỆ THỐNG BẢO VỆ TRẢI NGHIỆM NGƯỜI DÙNG (CORE SHIELD)
// ==========================================

// 1. BẮT LỖI TOÀN CỤC (ANTI-CRASH)
// Nếu có bất kỳ chức năng nào bị lỗi ngầm, app sẽ không bị kẹt mà tự động khôi phục
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.warn("⚠️ App phát hiện sự cố, đang tự động khôi phục...", msg);
    
    // Nếu có màn hình loading bị kẹt, tự động tắt nó đi
    let loader = document.getElementById('globalLoader');
    if(loader) loader.style.display = 'none';

    // Không báo lỗi đỏ ra màn hình người dùng, giữ app vẫn chạy được các nút khác
    return true; 
};

// 2. HÀM ĐỌC DỮ LIỆU SIÊU AN TOÀN (ANTI-CORRUPTION)
// Dùng cái này thay cho JSON.parse(localStorage...) để không bao giờ bị lỗi kẹt app do rác data
function safeGetLocal(key, defaultVal = "[]") {
    try {
        let data = localStorage.getItem(key);
        if (!data || data === "undefined" || data === "null") return JSON.parse(defaultVal);
        return JSON.parse(data);
    } catch (e) {
        console.error(`Lỗi dữ liệu tại [${key}], đã tự động reset để cứu app.`);
        localStorage.setItem(key, defaultVal);
        return JSON.parse(defaultVal);
    }
}

// 3. HÀM RENDER KHÔNG LÀM ĐƠ MÁY (ANTI-FREEZE YIELD)
// Dùng khi cần hiển thị hàng ngàn từ vựng mà không làm điện thoại bị treo
function renderWithoutFreezing(array, renderItemFunc, containerId, chunkSize = 50) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ""; // Xóa cũ
    
    let index = 0;
    function renderChunk() {
        let chunkHtml = "";
        let end = Math.min(index + chunkSize, array.length);
        
        for (let i = index; i < end; i++) {
            chunkHtml += renderItemFunc(array[i], i);
        }
        
        // Đẩy vào HTML bằng insertAdjacentHTML (nhanh hơn innerHTML rất nhiều)
        container.insertAdjacentHTML('beforeend', chunkHtml);
        index += chunkSize;
        
        if (index < array.length) {
            // Nhường CPU cho điện thoại thở, sau đó render tiếp
            requestAnimationFrame(renderChunk);
        }
    }
    renderChunk();
}

// ==========================================
// 1. QUẢN LÝ HỒ SƠ NGƯỜI CHƠI (PROFILE)
// ==========================================
class PlayerProfile {
    constructor() { this.load(); }
    
    load() {
        this.name = localStorage.getItem("playerName") || "Damon Nguyen";
        this.age = localStorage.getItem("playerAge") || "18";
        
        let rawHsk = localStorage.getItem("currentHSK") || "1";
        this.hsk = rawHsk.replace(/[^0-9]/g, '') || "1"; 

        this.rank = localStorage.getItem("rank") || "Đồng";
    }

    save(name, age, hsk) {
        let cleanHsk = hsk.toString().replace(/[^0-9]/g, '');
        localStorage.setItem("playerName", name);
        localStorage.setItem("playerAge", age);
        localStorage.setItem("currentHSK", cleanHsk);
        
        this.load(); 
        this.updateUI(); 
    }

    updateUI() {
        document.querySelectorAll("#playerName").forEach(el => el.innerText = this.name);
        document.querySelectorAll("#playerAge").forEach(el => el.innerText = this.age + " tuổi");
        document.querySelectorAll("#currentHSK").forEach(el => el.innerText = "HSK " + this.hsk);
        document.querySelectorAll("#playerRank").forEach(el => el.innerText = this.rank);
    }
}

// ==========================================
// 2. QUẢN LÝ TRANG CÀI ĐẶT (SETTING)
// ==========================================
class SettingManager {
    constructor(profile) { this.profile = profile; this.initUI(); }
    initUI() {
        const nameInput = document.getElementById("nameInput");
        if (!nameInput) return;
        nameInput.value = this.profile.name;
        document.getElementById("ageInput").value = this.profile.age;
        document.getElementById("hskSelect").value = "HSK " + this.profile.hsk;
    }
    saveSettings() {
        const name = document.getElementById("nameInput").value;
        const age = document.getElementById("ageInput").value;
        const hsk = document.getElementById("hskSelect").value.replace("HSK ", ""); 
        this.profile.save(name, age, hsk);
        alert("💾 Đã lưu cài đặt thành công!");
    }
}

// ==========================================
// 3. QUẢN LÝ TỪ VỰNG (VOCABULARY)
// ==========================================
class VocabManager {
    constructor() {
        this.vocabList = document.getElementById("vocabList");
        this.devMessage = document.getElementById("devMessage");
        if (this.vocabList) this.fetchData(1);
    }
    async fetchData(level) {
        try {
            const res = await fetch(`hsk-${level}.json`);
            if (!res.ok) throw new Error("Chưa có data");
            const data = await res.json();
            this.render(data.terms);
        } catch (err) { this.showDevMessage(level); }
    }
    render(terms) {
        this.devMessage.style.display = "none";
        this.vocabList.style.display = "block";
        this.vocabList.innerHTML = terms.map(item => `
            <div class="word-card">
                <div class="hanzi">${item.word || item.simplified}</div>
                <div class="pinyin">${item.pinyin}</div>
                <div class="meaning">${item.meaning || item.english}</div>
            </div>`).join('');
    }
    showDevMessage(level) {
        this.vocabList.style.display = "none";
        this.devMessage.innerHTML = `🚧 Từ vựng HSK ${level} đang phát triển.`;
        this.devMessage.style.display = "block";
    }
    changeTab(level, element) {
        document.querySelectorAll(".hsk-tab").forEach(t => t.classList.remove("active-tab"));
        element.classList.add("active-tab");
        this.fetchData(level);
    }
}

// ==========================================
// 4. QUẢN LÝ TRANG ÔN TẬP (REVIEW)
// ==========================================
class ReviewManager {
    constructor() {
        this.reviewList = document.getElementById("reviewList");
        if (this.reviewList) this.render();
    }
    
    render() {
        // 🔥 Đã thay bằng safeGetLocal ở đây (Bước 2)
        let words = safeGetLocal("reviewWords", "[]"); 
        const countEl = document.getElementById("reviewCount");
        
        if (words.length === 0) {
            this.reviewList.innerHTML = `
                <div class="review-empty-box">
                    <div class="review-empty-icon">🎉</div>
                    <div class="review-empty-title">Tuyệt vời!</div>
                    <div class="review-empty-desc">Bạn không có từ nào cần ôn tập.<br>Hãy tiếp tục thử sức với các Mini Game nhé!</div>
                </div>`;
            if (countEl) countEl.style.display = "none";
            return;
        }

        if (countEl) {
            countEl.style.display = "inline-block";
            countEl.innerText = `${words.length} từ cần ôn`;
        }

        this.reviewList.innerHTML = words.map((item, i) => `
            <div class="review-word-card">
                <div class="review-word-info">
                    <div class="hanzi">${item.word || item.simplified}</div>
                    <div class="pinyin">${item.pinyin || ''}</div>
                    <div class="meaning">${item.meaning || item.english || ''}</div>
                </div>
                <button class="btn-mastered" onclick="removeReviewWord(${i})">✓ Đã thuộc</button>
            </div>`).join('');
    }

    removeWord(index) {
        // 🔥 Đã thay bằng safeGetLocal ở đây (Bước 2)
        let words = safeGetLocal("reviewWords", "[]"); 
        words.splice(index, 1);
        localStorage.setItem("reviewWords", JSON.stringify(words));
        this.render();
    }
}


// ==========================================
// 5. QUẢN LÝ GAME 1 (THẦN TỐC HSK)
// ==========================================
class SpeedGameManager {
    constructor(profile) {
        this.profile = profile; 
        this.setupScreen = document.getElementById("setupScreen");
        if (!this.setupScreen) return;
        
        this.qCountInput = document.getElementById("questionCount");
        this.easySelect = document.getElementById("easyTimeSelect");
        this.startHskSelect = document.getElementById("startHskSelect");
        this.endHskSelect = document.getElementById("endHskSelect");
        this.gameModeTypeSelect = document.getElementById("gameModeType"); // Lấy ô chọn dạng đề
        
        this.mode = 'easy'; 
        this.quizType = 'hanzi_to_meaning'; // Biến lưu dạng đề
        this.allWords = [];
        this.gameWords = [];
        this.currentIndex = 0;
        this.score = 0;
        
        this.timer = null;
        this.elapsedTimer = null; 
        this.totalTimeElapsed = 0; 
        this.userHistory = []; 
        
        this.qCountInput.addEventListener('change', () => this.generateEasyTimeOptions());
        this.generateEasyTimeOptions();
    }
    checkHsk() {
        let start = parseInt(this.startHskSelect.value);
        let end = parseInt(this.endHskSelect.value);
        if (start > end) this.endHskSelect.value = start;
    }
    generateEasyTimeOptions() {
        let count = parseInt(this.qCountInput.value);
        if (count < 10) count = 10;
        if (count > 100) count = 100;
        let minMin = count / 10;          
        let maxMin = (count / 10) * 1.5;  
        let step = (count <= 50) ? 0.5 : 1; 
        this.easySelect.innerHTML = "";
        for (let i = minMin; i <= maxMin; i += step) {
            let minutes = Math.floor(i);
            let seconds = (i % 1) * 60;
            let text = seconds > 0 ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
            this.easySelect.innerHTML += `<option value="${i * 60}">${text}</option>`; 
        }
    }
    setMode(mode) {
        this.mode = mode;
        document.getElementById("easyModeCard").classList.remove("active-easy", "active");
        document.getElementById("hardModeCard").classList.remove("active-hard", "active");
        if (mode === 'easy') {
            document.getElementById("easyModeCard").classList.add("active-easy");
        } else {
            document.getElementById("hardModeCard").classList.add("active-hard");
        }
    }
    async start() {
        let startHsk = parseInt(this.startHskSelect.value);
        let endHsk = parseInt(this.endHskSelect.value);
        this.quizType = this.gameModeTypeSelect ? this.gameModeTypeSelect.value : 'hanzi_to_meaning';
        
        this.allWords = [];
        try {
            for (let level = startHsk; level <= endHsk; level++) {
                let res = await fetch(`hsk-${level}.json`);
                if (res.ok) {
                    let data = await res.json();
                    if (data.terms) this.allWords = this.allWords.concat(data.terms);
                }
            }
            if (this.allWords.length === 0) { alert("Không tìm thấy dữ liệu từ vựng!"); return; }
        } catch(e) { alert("Lỗi tải dữ liệu file JSON!"); return; }

        let reqCount = parseInt(this.qCountInput.value);
        if(this.allWords.length < reqCount) reqCount = this.allWords.length; 
        let shuffled = [...this.allWords].sort(() => 0.5 - Math.random());
        this.gameWords = shuffled.slice(0, reqCount);

        this.setupScreen.style.display = "none";
        document.getElementById("playScreen").style.display = "block";
        this.currentIndex = 0;
        this.score = 0;
        this.userHistory = []; 
        
        clearInterval(this.elapsedTimer);
        this.totalTimeElapsed = 0;
        this.elapsedTimer = setInterval(() => { this.totalTimeElapsed++; }, 1000);

        if (this.mode === 'easy') {
            this.timeLeft = parseInt(this.easySelect.value);
            this.maxTime = this.timeLeft;
            this.startGlobalTimer();
        }
        this.renderQuestion();
    }
    renderQuestion() {
        if (this.currentIndex >= this.gameWords.length) { this.endGame(); return; }
        let currentWord = this.gameWords[this.currentIndex];
        let currentHanzi = currentWord.word || currentWord.simplified;
        let currentMeaning = currentWord.meaning || currentWord.english;

        document.getElementById("progressText").innerText = `Câu ${this.currentIndex + 1}/${this.gameWords.length}`;

        // ĐỔI HIỂN THỊ ĐỀ THI TÙY THEO DẠNG ĐÃ CHỌN
        if (this.quizType === 'meaning_to_hanzi') {
            document.getElementById("questionHanzi").innerText = currentMeaning;
            document.getElementById("questionHanzi").style.fontSize = "36px"; // Thu nhỏ font chữ 1 chút nếu là tiếng Việt dài
        } else {
            document.getElementById("questionHanzi").innerText = currentHanzi;
            document.getElementById("questionHanzi").style.fontSize = "58px";
        }

        if (this.mode === 'hard') {
            this.timeLeft = parseInt(document.getElementById("hardTimeSelect").value);
            this.maxTime = this.timeLeft;
            this.startQuestionTimer(currentWord);
        }

        // Lọc đáp án sai dựa theo dạng đề
        let wrongOptions = this.allWords.filter(w => {
            let wText = (this.quizType === 'meaning_to_hanzi') ? (w.word || w.simplified) : (w.meaning || w.english);
            let cText = (this.quizType === 'meaning_to_hanzi') ? currentHanzi : currentMeaning;
            return wText !== cText;
        }).sort(() => 0.5 - Math.random()).slice(0, 3);

        let options = [currentWord, ...wrongOptions].sort(() => 0.5 - Math.random());
        const grid = document.getElementById("optionsGrid");
        grid.innerHTML = "";
        
        options.forEach(opt => {
            let btn = document.createElement("button");
            btn.className = "option-btn"; 
            
            let textPinyin = opt.pinyin || "";
            let textMean = opt.meaning || opt.english || "";
            let textHanzi = opt.word || opt.simplified || "";
            
            // RENDER CÁC NÚT ĐÁP ÁN TƯƠNG ỨNG
            if (this.quizType === 'meaning_to_hanzi') {
                // Đề là Nghĩa -> Đáp án là Hán tự + Pinyin
                btn.innerHTML = `<span style="font-size:24px; font-weight:bold; color:#333;">${textHanzi}</span><br><span style="font-size:13px; color:#555;">${textPinyin}</span>`;
            } else {
                // Đề là Hán tự -> Đáp án theo chế độ Dễ/Khó cũ
                if (this.mode === 'hard') {
                    btn.innerHTML = `<span style="font-size:16px; font-weight:bold; color:#333;">${textMean}</span>`;
                } else {
                    btn.innerHTML = `<span style="color:#333;">${textPinyin}</span><br><span style="font-size:14px; font-weight:normal; color:#555;">${textMean}</span>`;
                }
            }
            
            btn.onclick = () => this.checkAnswer(opt, currentWord);
            grid.appendChild(btn);
        });
    }
    checkAnswer(selected, correct) {
        if (this.mode === 'hard') clearInterval(this.timer); 
        
        let selText = (this.quizType === 'meaning_to_hanzi') ? (selected.word || selected.simplified) : (selected.meaning || selected.english);
        let corrText = (this.quizType === 'meaning_to_hanzi') ? (correct.word || correct.simplified) : (correct.meaning || correct.english);
        let isCorrect = (selText === corrText);
        
        if (isCorrect) this.score++;
        else this.saveToReview(correct); 
        
        let displayCorrect = (this.quizType === 'meaning_to_hanzi') ? (correct.word || correct.simplified) : (correct.meaning || correct.english);
        let displaySelected = (this.quizType === 'meaning_to_hanzi') ? (selected.word || selected.simplified) : (selected.meaning || selected.english);

        this.userHistory.push({
            hanzi: correct.word || correct.simplified,
            pinyin: correct.pinyin,
            correctMeaning: displayCorrect,
            selectedMeaning: displaySelected,
            isCorrect: isCorrect,
            quizType: this.quizType
        });
        
        this.currentIndex++;
        this.renderQuestion();
    }
    startGlobalTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                for(let i = this.currentIndex; i < this.gameWords.length; i++) { 
                    let w = this.gameWords[i];
                    this.saveToReview(w); 
                    let displayCorrect = (this.quizType === 'meaning_to_hanzi') ? (w.word || w.simplified) : (w.meaning || w.english);
                    this.userHistory.push({
                        hanzi: w.word || w.simplified, pinyin: w.pinyin,
                        correctMeaning: displayCorrect, selectedMeaning: "⏳ Hết giờ", isCorrect: false, quizType: this.quizType
                    });
                }
                this.endGame();
            }
        }, 1000);
    }
    startQuestionTimer(currentWord) {
        clearInterval(this.timer);
        this.updateTimerUI(); 
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.saveToReview(currentWord); 
                let displayCorrect = (this.quizType === 'meaning_to_hanzi') ? (currentWord.word || currentWord.simplified) : (currentWord.meaning || currentWord.english);
                this.userHistory.push({
                    hanzi: currentWord.word || currentWord.simplified, pinyin: currentWord.pinyin,
                    correctMeaning: displayCorrect, selectedMeaning: "⏳ Hết giờ", isCorrect: false, quizType: this.quizType
                });
                this.currentIndex++;
                this.renderQuestion();
            }
        }, 1000);
    }
    updateTimerUI() {
        let pct = (this.timeLeft / this.maxTime) * 100;
        document.getElementById("timerFill").style.width = pct + "%";
        if (this.mode === 'easy') {
            let m = Math.floor(this.timeLeft / 60);
            let s = this.timeLeft % 60;
            document.getElementById("timerText").innerText = `${m}:${s < 10 ? '0':''}${s}`;
        } else {
            document.getElementById("timerText").innerText = `${this.timeLeft}s`;
        }
    }
    saveToReview(word) {
        let words = JSON.parse(localStorage.getItem("reviewWords") || "[]");
        let targetText = word.word || word.simplified;
        if (!words.some(w => (w.word || w.simplified) === targetText)) {
            words.push(word);
            localStorage.setItem("reviewWords", JSON.stringify(words));
        }
    }
    endGame() {
        clearInterval(this.timer);
        clearInterval(this.elapsedTimer); 
        
        document.getElementById("playScreen").style.display = "none";
        document.getElementById("resultScreen").style.display = "block";
        document.getElementById("scoreText").innerText = `${this.score} / ${this.gameWords.length}`;
        
        let m = Math.floor(this.totalTimeElapsed / 60);
        let s = this.totalTimeElapsed % 60;
        document.getElementById("g1TotalTime").innerText = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
        
        let historyHtml = "";
        this.userHistory.forEach(item => {
            let statusClass = item.isCorrect ? "correct" : "wrong";
            let userPickText = item.isCorrect 
                ? `<span class="g1-highlight-correct">Đúng: ${item.selectedMeaning}</span>`
                : `Bạn chọn: <span class="g1-highlight-wrong">${item.selectedMeaning}</span> | Đáp án: <span class="g1-highlight-correct">${item.correctMeaning}</span>`;
            
            let titleHeader = (item.quizType === 'meaning_to_hanzi') 
                ? `Nghĩa: ${item.correctMeaning}` 
                : `${item.hanzi} (${item.pinyin})`;

            historyHtml += `
                <div class="g1-history-item ${statusClass}">
                    <div class="g1-history-hanzi">${titleHeader}</div>
                    <div class="g1-history-detail">${userPickText}</div>
                </div>`;
        });
        document.getElementById("g1HistoryList").innerHTML = historyHtml;
    }
    resetGame() {
        clearInterval(this.timer);
        clearInterval(this.elapsedTimer);
        this.timer = null;
        document.getElementById("resultScreen").style.display = "none";
        document.getElementById("playScreen").style.display = "none";
        this.setupScreen.style.display = "block";
    }
}


// ==========================================
// 8. QUẢN LÝ GAME 2 (PINYIN GAME)
// ==========================================
class PinyinGameManager {
    constructor(profile) {
        this.profile = profile; 
        this.setupScreen = document.getElementById("game2Setup");
        if (!this.setupScreen) return; 

        this.qCountInput = document.getElementById("g2QuestionCount");
        this.easySelect = document.getElementById("g2EasyTimeSelect");
        this.startHskSelect = document.getElementById("g2StartHskSelect");
        this.endHskSelect = document.getElementById("g2EndHskSelect");
        this.mode = 'easy'; 
        this.allWords = [];
        this.gameWords = [];
        this.currentIndex = 0;
        this.score = 0;
        
        this.timer = null;
        this.elapsedTimer = null; // Bộ đếm tổng thời gian
        this.totalTimeElapsed = 0;
        this.userHistory = []; 

        this.toneGroups = [
            ["a", "ā", "á", "ǎ", "à"], ["e", "ē", "é", "ě", "è"],
            ["i", "ī", "í", "ǐ", "ì"], ["o", "ō", "ó", "ǒ", "ò"],
            ["u", "ū", "ú", "ǔ", "ù"]
        ];

        this.qCountInput.addEventListener('change', () => this.generateEasyTimeOptions());
        this.generateEasyTimeOptions();
        this.setMode('easy'); 
    }
    checkHsk() {
        let start = parseInt(this.startHskSelect.value);
        let end = parseInt(this.endHskSelect.value);
        if (start > end) this.endHskSelect.value = start;
    }
    generateEasyTimeOptions() {
        let count = parseInt(this.qCountInput.value);
        if (count < 10) count = 10;
        if (count > 100) count = 100;
        let minMin = count / 10;          
        let maxMin = (count / 10) * 1.5;  
        let step = (count <= 50) ? 0.5 : 1; 
        this.easySelect.innerHTML = "";
        for (let i = minMin; i <= maxMin; i += step) {
            let minutes = Math.floor(i);
            let seconds = (i % 1) * 60;
            let text = seconds > 0 ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
            this.easySelect.innerHTML += `<option value="${i * 60}">${text}</option>`; 
        }
    }
    setMode(mode) {
        this.mode = mode;
        document.getElementById("g2EasyModeCard").classList.remove("active-easy");
        document.getElementById("g2HardModeCard").classList.remove("active-hard");
        if (mode === 'easy') document.getElementById("g2EasyModeCard").classList.add("active-easy");
        else document.getElementById("g2HardModeCard").classList.add("active-hard");
    }
    generateDistractors(correctPinyin) {
        let distractors = new Set();
        const swapTone = (py) => {
            for (let group of this.toneGroups) {
                for (let char of group) {
                    if (py.includes(char)) {
                        let otherTones = group.filter(t => t !== char);
                        let randomTone = otherTones[Math.floor(Math.random() * otherTones.length)];
                        return py.replace(char, randomTone);
                    }
                }
            }
            return py; 
        };
        const swapConsonant = (py) => {
            let words = py.split(' ');
            words = words.map(w => {
                if (w.startsWith('zh')) return w.replace('zh', 'z');
                if (w.startsWith('z')) return w.replace('z', 'zh');
                if (w.startsWith('sh')) return w.replace('sh', 's');
                if (w.startsWith('s')) return w.replace('s', 'sh');
                if (w.startsWith('b')) return w.replace('b', 'p');
                if (w.startsWith('p')) return w.replace('p', 'b');
                if (w.startsWith('n')) return w.replace('n', 'l');
                if (w.startsWith('l')) return w.replace('l', 'n');
                return w;
            });
            let res = words.join(' ');
            return res !== py ? res : swapTone(swapTone(py)); 
        };
        const swapEnding = (py) => {
            let words = py.split(' ');
            words = words.map(w => {
                if (w.endsWith('ng')) return w.slice(0, -1);
                if (w.endsWith('n')) return w + 'g';
                return w;
            });
            let res = words.join(' ');
            return res !== py ? res : swapTone(py + "r"); 
        };
        let d1 = swapTone(correctPinyin);
        let d2 = swapConsonant(correctPinyin);
        let d3 = swapEnding(correctPinyin);
        [d1, d2, d3].forEach(d => { if (d !== correctPinyin) distractors.add(d); });
        let attempts = 0;
        while(distractors.size < 3 && attempts < 15) {
            let temp = swapTone(correctPinyin);
            if (temp !== correctPinyin) distractors.add(temp);
            attempts++;
        }
        return Array.from(distractors).slice(0, 3);
    }
    async start() {
        let startHsk = parseInt(this.startHskSelect.value);
        let endHsk = parseInt(this.endHskSelect.value);
        this.allWords = [];
        try {
            for (let level = startHsk; level <= endHsk; level++) {
                let res = await fetch(`hsk-${level}.json`);
                if (res.ok) {
                    let data = await res.json();
                    if (data.terms) this.allWords = this.allWords.concat(data.terms);
                }
            }
            if (this.allWords.length === 0) return alert("Không tìm thấy dữ liệu!");
        } catch(e) { return alert("Lỗi tải dữ liệu file JSON!"); }

        let reqCount = parseInt(this.qCountInput.value);
        if(this.allWords.length < reqCount) reqCount = this.allWords.length; 
        let shuffled = [...this.allWords].sort(() => 0.5 - Math.random());
        this.gameWords = shuffled.slice(0, reqCount);

        this.setupScreen.style.display = "none";
        document.getElementById("game2PlayScreen").style.display = "block";
        this.currentIndex = 0;
        this.score = 0;
        this.userHistory = [];

        // Bắt đầu đếm tổng thời gian chơi
        clearInterval(this.elapsedTimer);
        this.totalTimeElapsed = 0;
        this.elapsedTimer = setInterval(() => { this.totalTimeElapsed++; }, 1000);

        if (this.mode === 'easy') {
            this.timeLeft = parseInt(this.easySelect.value);
            this.maxTime = this.timeLeft;
            this.startGlobalTimer();
        }
        this.renderQuestion();
    }
    renderQuestion() {
        if (this.currentIndex >= this.gameWords.length) { this.endGame(); return; }
        let currentWord = this.gameWords[this.currentIndex];
        let currentHanzi = currentWord.word || currentWord.simplified;
        let correctPinyin = currentWord.pinyin;

        document.getElementById("g2ProgressText").innerText = `Câu ${this.currentIndex + 1}/${this.gameWords.length}`;
        document.getElementById("g2QuestionHanzi").innerText = currentHanzi;

        if (this.mode === 'hard') {
            this.timeLeft = parseInt(document.getElementById("g2HardTimeSelect").value);
            this.maxTime = this.timeLeft;
            this.startQuestionTimer();
        }
        let wrongOptions = this.generateDistractors(correctPinyin);
        let options = [correctPinyin, ...wrongOptions].sort(() => 0.5 - Math.random());
        const grid = document.getElementById("g2OptionsGrid");
        grid.innerHTML = "";
        
        options.forEach(opt => {
            let btn = document.createElement("button");
            btn.innerText = opt;
            btn.onclick = (e) => this.checkAnswer(opt, currentWord, e.target, options);
            grid.appendChild(btn);
        });
    }
    checkAnswer(selectedPinyin, currentWord, clickedBtn, allOptionsRendered) {
        if (this.mode === 'hard') clearInterval(this.timer); 
        
        let allBtns = document.getElementById("g2OptionsGrid").querySelectorAll("button");
        allBtns.forEach(b => b.classList.add("btn-option-disabled"));

        let correctPinyin = currentWord.pinyin;
        let isCorrect = (selectedPinyin === correctPinyin);

        if (isCorrect) {
            this.score++;
            clickedBtn.classList.add("btn-option-correct");
        } else {
            clickedBtn.classList.add("btn-option-wrong");
            allBtns.forEach(b => { if(b.innerText === correctPinyin) b.classList.add("btn-option-correct"); });
            this.saveToReview(currentWord); 
        }
        this.userHistory.push({
            hanzi: currentWord.word || currentWord.simplified, correctPinyin: correctPinyin,
            selectedPinyin: selectedPinyin, isCorrect: isCorrect, meaning: currentWord.meaning || currentWord.english
        });

        setTimeout(() => { this.currentIndex++; this.renderQuestion(); }, 800);
    }
    startGlobalTimer() {
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.markRemainingAsWrong();
                this.endGame();
            }
        }, 1000);
    }
    startQuestionTimer() {
        clearInterval(this.timer);
        this.updateTimerUI(); 
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerUI();
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                let currentWord = this.gameWords[this.currentIndex];
                this.saveToReview(currentWord); 
                this.userHistory.push({
                    hanzi: currentWord.word || currentWord.simplified, correctPinyin: currentWord.pinyin,
                    selectedPinyin: "⏳ Hết giờ", isCorrect: false, meaning: currentWord.meaning || currentWord.english
                });
                this.currentIndex++;
                this.renderQuestion();
            }
        }, 1000);
    }
    markRemainingAsWrong() {
        for(let i = this.currentIndex; i < this.gameWords.length; i++) {
            let word = this.gameWords[i];
            this.saveToReview(word);
            this.userHistory.push({
                hanzi: word.word || word.simplified, correctPinyin: word.pinyin,
                selectedPinyin: "⏳ Hết giờ", isCorrect: false, meaning: word.meaning || word.english
            });
        }
    }
    updateTimerUI() {
        let pct = (this.timeLeft / this.maxTime) * 100;
        document.getElementById("g2TimerFill").style.width = pct + "%";
        if (this.mode === 'easy') {
            let m = Math.floor(this.timeLeft / 60);
            let s = this.timeLeft % 60;
            document.getElementById("g2TimerText").innerText = `${m}:${s < 10 ? '0':''}${s}`;
        } else {
            document.getElementById("g2TimerText").innerText = `${this.timeLeft}s`;
        }
    }
    saveToReview(word) {
        let words = JSON.parse(localStorage.getItem("reviewWords") || "[]");
        let targetText = word.word || word.simplified;
        if (!words.some(w => (w.word || w.simplified) === targetText)) {
            words.push(word);
            localStorage.setItem("reviewWords", JSON.stringify(words));
        }
    }
    endGame() {
        clearInterval(this.timer);
        clearInterval(this.elapsedTimer); // Dừng tổng thời gian
        
        document.getElementById("game2PlayScreen").style.display = "none";
        document.getElementById("game2ResultScreen").style.display = "block";
        document.getElementById("g2ScoreText").innerText = `${this.score} / ${this.gameWords.length}`;
        
        // Hiển thị tổng thời gian
        let m = Math.floor(this.totalTimeElapsed / 60);
        let s = this.totalTimeElapsed % 60;
        document.getElementById("g2TotalTime").innerText = m > 0 ? `${m} phút ${s} giây` : `${s} giây`;
        
        let historyHtml = "";
        this.userHistory.forEach(item => {
            let statusClass = item.isCorrect ? "correct" : "wrong";
            let userPickText = item.isCorrect 
                ? `<span class="g2-highlight-correct">Đúng: ${item.selectedPinyin}</span>`
                : `Bạn chọn: <span class="g2-highlight-wrong">${item.selectedPinyin}</span> | Đáp án: <span class="g2-highlight-correct">${item.correctPinyin}</span>`;
            historyHtml += `
                <div class="g2-history-item ${statusClass}">
                    <div class="g2-history-hanzi">${item.hanzi} - ${item.meaning}</div>
                    <div class="g2-history-detail">${userPickText}</div>
                </div>`;
        });
        document.getElementById("g2HistoryList").innerHTML = historyHtml;
    }
    resetGame() {
        clearInterval(this.timer);
        clearInterval(this.elapsedTimer);
        this.timer = null;
        document.getElementById("game2ResultScreen").style.display = "none";
        document.getElementById("game2PlayScreen").style.display = "none";
        this.setupScreen.style.display = "block";
    }
}


class HSKGameApp {
    constructor() {
        this.profile = new PlayerProfile();
        window.onload = () => {
            this.profile.updateUI();
            this.setting = new SettingManager(this.profile);
            this.vocab = new VocabManager();
            this.review = new ReviewManager();
            
            // Tự động detect xem người dùng đang mở trang game nào
            if (document.getElementById("setupScreen")) {
                this.speedGame = new SpeedGameManager(this.profile);
            }
            if (document.getElementById("game2Setup")) {
                this.pinyinGame = new PinyinGameManager(this.profile);
            }
        };
    }
}
const app = new HSKGameApp();

// Các hàm Global cũ (giữ nguyên)
function saveSetting() { app.setting.saveSettings(); }
function changeHSK(level, element) { app.vocab.changeTab(level, element); }
function removeReviewWord(index) { app.review.removeWord(index); }
function selectGameMode(mode) { app.speedGame.setMode(mode); }
function startSpeedGame() { app.speedGame.start(); }
function checkGameHsk() { app.speedGame.checkHsk(); }
function resetSpeedGame() { app.speedGame.resetGame(); }
function leaveGame() {
    if (app && app.speedGame) clearInterval(app.speedGame.timer);
    window.location.href = 'gamecenter.html';
}

// ==========================================
// THÊM: Các hàm Global mới cho Game 2
// ==========================================
function selectGame2Mode(mode) { app.pinyinGame.setMode(mode); }
function startGame2() { app.pinyinGame.start(); }
function checkGame2Hsk() { app.pinyinGame.checkHsk(); }
function resetGame2() { app.pinyinGame.resetGame(); }
function leaveGame2() {
    if (app && app.pinyinGame) clearInterval(app.pinyinGame.timer);
    window.location.href = 'gamecenter.html';
}

// ==========================================
// 7. BẢO VỆ MÀN HÌNH LOADING (BƯỚC 3)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // Tự động tìm xem có màn hình loading nào không
    let loader = document.getElementById('globalLoader') || document.getElementById('loadingScreen');
    if (loader) {
        // Failsafe: Ép buộc ẩn loading sau đúng 3 giây (3000ms) để cứu app khỏi bị kẹt
        setTimeout(() => {
            if (loader.style.display !== 'none') {
                loader.style.display = 'none';
                console.log("⚠️ Đã tự động tắt màn hình Loading bị kẹt!");
            }
        }, 3000);
    }
});
