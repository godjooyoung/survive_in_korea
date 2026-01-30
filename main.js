// 게임 상태 관리	
let gameState = {
	timeLimit: 0, // 초 단위
	timeRemaining: 0,
	currentStage: 0,
	survival: 100,
	distance: 0,
	decisions: 0,
	selectedChoiceIndex: 0,
	timerInterval: null
};

let STORY = null;

// 돔요소
const imageWrap = document.querySelector('.game_image_wrap');
const storyWrap = document.querySelector('.game_story_wrap');
const startBtn = document.querySelector('#game_start_btn');

// 1. 스토리데이터 불러오는 함수
async function loadStory() {
  const res = await fetch("/data/story.json", { cache: "no-store" });
  if (!res.ok) throw new Error("story.json load failed");
  STORY = await res.json();
}


// 

function renderChoices(choices) {
  const wrap = document.createElement('div');
  wrap.className = 'choice_wrap';

  choices.forEach(choice => {
    const btn = document.createElement('div');
    btn.className = 'g_button';
    btn.innerText = choice.text;
    btn.onclick = () => goToEpisode(choice.next);
    wrap.appendChild(btn);
  });

  storyWrap.appendChild(wrap);
}


let bgmPlayer = new Audio();
bgmPlayer.loop = true;

function playBGM(src) {
  if (bgmPlayer.src.includes(src)) return;
  bgmPlayer.src = src;
  bgmPlayer.volume = 0.5;
  bgmPlayer.play().catch(()=>{});
}

function playSFX(src) {
  const sfx = new Audio(src);
  sfx.volume = 0.9;
  sfx.play().catch(()=>{});
}




// 2. 다음 라인 진행
function nextLine(node, index) {
  const nextIndex = index + 1;

  if (nextIndex < node.prompts.length) {
    renderPrompt(node, nextIndex);
  } else {
    goToEpisode(node.next);
  }
}

// 이미지 처리 함수 
function updateSceneImage(imgPath) {
  if (imgPath) {
    imageWrap.style.backgroundImage = `url(${imgPath})`;
    imageWrap.style.backgroundColor = 'transparent';
  } else {
    imageWrap.style.backgroundImage = 'none';
    imageWrap.style.backgroundColor = '#0A0D13'; // 기본 단색
  }
}


// 3. 프롬프트 랜더링 함수
function renderPrompt(node, index) {
  const prompt = node.prompts[index];
  if (!prompt) return;

  // 이미지 처리
  if (prompt.img) {
		updateSceneImage(prompt.img);
  } else {
    updateSceneImage();
  }

  // 텍스트 출력
  storyWrap.innerHTML = `
    <div class="story_bubble ${prompt.type}">
      ${prompt.text}
    </div>
  `;

  // 효과음 있으면 재생
  if (prompt.sfx) playSFX(prompt.sfx);

  // 다음 버튼 or 선택지
  if (node.type == 'lines') {
    const btn = document.createElement('div');
    btn.className = 'g_button';
    btn.innerText = '다음';
    btn.onclick = () => nextLine(node, index);
    storyWrap.appendChild(btn);
  }

  if (node.type === 'choice' && index === node.prompts.length - 1) {
    renderChoices(node.choices);
  }
}



// 4. 에피소드 랜더링 함수
function renderEpisode(epId) {
  const node = STORY.nodes[epId];
  if (!node) return;

  // 화면 초기화
  imageWrap.innerHTML = '';
  storyWrap.innerHTML = '';

  // 🎵 BGM 변경
  if (node.bgm) {
    playBGM(node.bgm);
  }

  // 첫 프롬프트 출력
  renderPrompt(node, 0);
}

// 5. 에피소드 이동 함수
function goToEpisode(epId) {
  gameState.currentEpisode = epId;
  gameState.currentPromptIndex = 0;
  renderEpisode(epId);
}


function startLifeTimer() {
  // 3~5분 랜덤 (초 단위)
  const min = 3 * 60;
  const max = 5 * 60;
  gameState.timeLimit = Math.floor(Math.random() * (max - min + 1)) + min;
  gameState.timeRemaining = gameState.timeLimit;

  gameState.timerInterval = setInterval(() => {
    gameState.timeRemaining--;

    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timerInterval);
      goToEpisode('ep_end'); // 강제 엔딩 이동
    }
  }, 1000);
}



startBtn.addEventListener('click', async () => {
  await loadStory();
  startLifeTimer();     // 생존 타이머 시작
  goToEpisode('ep1');   // 무조건 ep1 시작
});


// 타이머 시작
function startTimer() {
	gameState.timerInterval = setInterval(() => {
		gameState.timeRemaining--;
		updateTimerDisplay();

		if (gameState.timeRemaining <= 0) {
			endGame('시간이 다 되었습니다. 당신은 생존에 실패했습니다.');
		}
	}, 1000);
}

// 타이머 표시 업데이트
function updateTimerDisplay() {
	const percentage = (gameState.timeRemaining / gameState.timeLimit) * 100;
	document.getElementById('timer-fill').style.width = percentage + '%';
}





