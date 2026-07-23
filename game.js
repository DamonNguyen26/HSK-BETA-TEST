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
// 5. QUẢN LÝ MINI GAME (SPEED GAME)
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

        this.mode = 'easy'; 
        this.allWords = [];
        this.gameWords = [];
        this.currentIndex = 0;
        this.score = 0;
        this.timer = null;

        this.qCountInput.addEventListener('change', () => this.generateEasyTimeOptions());
        this.generateEasyTimeOptions();
    }

    // Tự động kiểm tra nếu HSK bắt đầu > HSK kết thúc
    checkHsk() {
        let start = parseInt(this.startHskSelect.value);
        let end = parseInt(this.endHskSelect.value);

        if (start > end) {
            this.endHskSelect.value = start;
        }
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

    // 1. Cập nhật hàm setMode để chuẩn khớp với class CSS tạo viền màu Xanh/Đỏ
    setMode(mode) {
        this.mode = mode;
        
        // Gỡ bỏ hiệu ứng màu đang chọn ở cả 2 nút
        document.getElementById("easyModeCard").classList.remove("active-easy", "active");
        document.getElementById("hardModeCard").classList.remove("active-hard", "active");
        
        // Thêm màu tương ứng cho nút được chọn
        if (mode === 'easy') {
            document.getElementById("easyModeCard").classList.add("active-easy");
        } else {
            document.getElementById("hardModeCard").classList.add("active-hard");
        }
    }


    async start() {
        let startHsk = parseInt(this.startHskSelect.value);
        let endHsk = parseInt(this.endHskSelect.value);
        this.allWords = [];

        try {
            // Lặp và đọc gộp các file JSON từ startHsk đến endHsk
            for (let level = startHsk; level <= endHsk; level++) {
                let res = await fetch(`hsk-${level}.json`);
                if (res.ok) {
                    let data = await res.json();
                    if (data.terms) {
                        this.allWords = this.allWords.concat(data.terms);
                    }
                }
            }

            if (this.allWords.length === 0) {
                alert("Không tìm thấy dữ liệu từ vựng cho HSK đã chọn!");
                return;
            }

        } catch(e) {
            alert("Lỗi tải dữ liệu file JSON!");
            return;
        }

        let reqCount = parseInt(this.qCountInput.value);
        if(this.allWords.length < reqCount) {
            reqCount = this.allWords.length; 
        }

        let shuffled = [...this.allWords].sort(() => 0.5 - Math.random());
        this.gameWords = shuffled.slice(0, reqCount);

        this.setupScreen.style.display = "none";
        document.getElementById("playScreen").style.display = "block";
        
        this.currentIndex = 0;
        this.score = 0;

        if (this.mode === 'easy') {
            this.timeLeft = parseInt(this.easySelect.value);
            this.maxTime = this.timeLeft;
            this.startGlobalTimer();
        }

        this.renderQuestion();
    }

    // 2. Cập nhật hàm renderQuestion để ẩn Pinyin khi chơi Khó
    renderQuestion() {
        if (this.currentIndex >= this.gameWords.length) {
            this.endGame();
            return;
        }

        let currentWord = this.gameWords[this.currentIndex];
        let currentHanzi = currentWord.word || currentWord.simplified;

        document.getElementById("progressText").innerText = `Câu ${this.currentIndex + 1}/${this.gameWords.length}`;
        document.getElementById("questionHanzi").innerText = currentHanzi;

        if (this.mode === 'hard') {
            this.timeLeft = parseInt(document.getElementById("hardTimeSelect").value);
            this.maxTime = this.timeLeft;
            this.startQuestionTimer(currentWord);
        }

        // Tạo đáp án sai dựa trên trường word/simplified
        let wrongOptions = this.allWords.filter(w => (w.word || w.simplified) !== currentHanzi)
                                        .sort(() => 0.5 - Math.random())
                                        .slice(0, 3);
        let options = [currentWord, ...wrongOptions].sort(() => 0.5 - Math.random());

        const grid = document.getElementById("optionsGrid");
        grid.innerHTML = "";
        
        options.forEach(opt => {
            let btn = document.createElement("button");
            // Thêm class để CSS trong style.css tự động bắt giao diện
            btn.className = "option-btn"; 
            
            let textPinyin = opt.pinyin || "";
            let textMean = opt.meaning || opt.english || "";
            
            // ===============================================
            // LOGIC PHÂN LOẠI CHẾ ĐỘ CHƠI TẠI ĐÂY
            // ===============================================
            if (this.mode === 'hard') {
                // CHẾ ĐỘ KHÓ: Chỉ hiển thị Nghĩa, không có Pinyin
                btn.innerHTML = `<span style="font-size:16px; font-weight:bold; color:#333;">${textMean}</span>`;
            } else {
                // CHẾ ĐỘ DỄ: Hiển thị cả Pinyin và Nghĩa
                btn.innerHTML = `<span style="color:#333;">${textPinyin}</span><br><span style="font-size:14px; font-weight:normal; color:#555;">${textMean}</span>`;
            }
            
            btn.onclick = () => this.checkAnswer(opt, currentWord);
            grid.appendChild(btn);
        });
    }

    checkAnswer(selected, correct) {
        if (this.mode === 'hard') clearInterval(this.timer); 

        let selText = selected.word || selected.simplified;
        let corrText = correct.word || correct.simplified;

        if (selText === corrText) {
            this.score++;
        } else {
            this.saveToReview(correct); 
        }

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
                    this.saveToReview(this.gameWords[i]);
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
        document.getElementById("playScreen").style.display = "none";
        document.getElementById("resultScreen").style.display = "block";
        document.getElementById("scoreText").innerText = `${this.score} / ${this.gameWords.length}`;
    }

    resetGame() {
        clearInterval(this.timer);
        this.timer = null;
        document.getElementById("resultScreen").style.display = "none";
        document.getElementById("playScreen").style.display = "none";
        this.setupScreen.style.display = "block";
    }
}

// ==========================================
// 6. KHỞI TẠO ỨNG DỤNG & SỰ KIỆN HTML
// ==========================================
class HSKGameApp {
    constructor() {
        this.profile = new PlayerProfile();
        window.onload = () => {
            this.profile.updateUI();
            this.setting = new SettingManager(this.profile);
            this.vocab = new VocabManager();
            this.review = new ReviewManager();
            this.speedGame = new SpeedGameManager(this.profile);
        };
    }
}
const app = new HSKGameApp();

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
