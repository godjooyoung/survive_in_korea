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
const gameTitle = document.querySelector('.game_title');
const imageWrap = document.querySelector('.game_image_wrap');
const storyWrap = document.querySelector('.game_story_wrap');
const storyArea = document.querySelector('.story_area');
const buttonWrap = document.querySelector('.button_wrap');

const startBtn = document.querySelector('#game_start_btn');


// 상태바
const statusBar = document.querySelector('.status_bar');


let sfxPlayer = new Audio();
sfxPlayer.loop = false;


// 1. 스토리데이터 불러오는 함수
async function loadStory() {
	const res = await fetch("/data/story.json", { cache: "no-store" });
	if (!res.ok) throw new Error("story.json load failed");
	STORY = await res.json();
}



function updateStatusBar() {
	const percent = (gameState.timeRemaining / gameState.timeLimit) * 100;
	statusBar.style.width = percent + '%';
}


function renderChoices(choices) {

	buttonWrap.innerHTML = '';

	const wrap = document.createElement('div');
	wrap.className = 'choice_wrap';

	choices.forEach(choice => {
		const btn = document.createElement('div');
		btn.className = 'g_button';
		btn.innerText = choice.text;
		btn.onclick = () => goToEpisode(choice.next);
		wrap.appendChild(btn);
	});

	buttonWrap.appendChild(wrap);
}



let bgmPlayer = new Audio();
bgmPlayer.loop = true;

function playBGM(src) {
	if (bgmPlayer.src.includes(src)) return;
	bgmPlayer.src = src;
	bgmPlayer.volume = 0.5;
	bgmPlayer.play().catch(() => { });
}

// function playSFX(src) {
//   const sfx = new Audio(src);
//   sfx.volume = 0.9;
//   sfx.play().catch(()=>{});


// }

function playSFX(src) {
	if (!src) {
		// 🔥 새 sfx 없으면 기존 소리 정지
		sfxPlayer.pause();
		sfxPlayer.currentTime = 0;
		return;
	}

	sfxPlayer.src = src;
	sfxPlayer.volume = 0.4;
	sfxPlayer.play().catch(() => { });
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
function renderPrompt_old(node, index) {
	const prompt = node.prompts[index];
	if (!prompt) return;

	// 이미지 처리
	if (prompt.img) {
		updateSceneImage(prompt.img);
	} else {
		updateSceneImage();
	}

	// 텍스트 출력 버블 생성
	const bubble = document.createElement('div');
	bubble.className = `story_bubble ${prompt.type}`;
	storyWrap.innerHTML = "";
	storyWrap.appendChild(bubble);


	function showNextButton() {
		const btn = document.createElement('div');
		btn.className = 'g_button';
		btn.innerText = '다음';
		btn.onclick = () => nextLine(node, index);
		storyWrap.appendChild(btn);
	}


	// 효과음 있으면 재생
	// if (prompt.sfx) playSFX(prompt.sfx);

	playSFX(prompt.sfx);

	// 🔹 텍스트 출력 방식 = 타이핑 으로 글자가 나오냐 그냥 나오냐
	if (prompt.type == "normal_msg") {
		// 타이핑 끝난 뒤 버튼 생성
		typeWriterEffect(bubble, prompt.text, 25, () => {
			if (node.type == 'lines') showNextButton();
			if (node.type == 'choice' && index == node.prompts.length - 1) {
				renderChoices(node.choices);
			}
		});
	} else {
		// 즉시 출력
		bubble.innerHTML = prompt.text;

		if (node.type == 'lines') showNextButton();
		if (node.type == 'choice' && index == node.prompts.length - 1) {
			renderChoices(node.choices);
		}
	}
}

function renderPrompt(node, index) {
	const prompt = node.prompts[index];

	if (!prompt) return;

	// 이미지 처리
	if (prompt.img) {
		updateSceneImage(prompt.img);
	} else {
		updateSceneImage();
	}


	// 효과음 있으면 재생
	// if (prompt.sfx) playSFX(prompt.sfx);
	playSFX(prompt.sfx);


	storyArea.innerHTML = '';
	buttonWrap.innerHTML = ''; // 버튼 영역 항상 초기화

	const bubble = document.createElement('div');
	bubble.className = `story_bubble ${prompt.type}`;
	storyArea.appendChild(bubble);

	function showNextButton() {
		const btn = document.createElement('div');
		btn.className = 'g_button';
		btn.innerText = '다음';
		btn.onclick = () => nextLine(node, index);
		buttonWrap.appendChild(btn);
	}



	const isLastPrompt = index === node.prompts.length - 1;

	function afterTextRender() {
		if (node.type == 'lines') {
			showNextButton();
		}

		if (node.type == 'choice' && isLastPrompt) {
			renderChoices(node.choices); // 🔥 선택지만 표시
		}
	}



	// 텍스트 출력
	if (prompt.type == "normal_msg") {
		typeWriterEffect(bubble, prompt.text, 25, afterTextRender);
	} else {
		bubble.innerHTML = prompt.text;
		afterTextRender();
	}

}






// 4. 에피소드 랜더링 함수
function renderEpisode(epId) {
	const node = STORY.nodes[epId];
	if (!node) return;

	// 화면 초기화
	// imageWrap.innerHTML = '';
	// storyWrap.innerHTML = '';

	storyArea.innerHTML = '';
	buttonWrap.innerHTML = '';

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



// 타이핑 함수
function typeWriterEffect(element, htmlText, speed = 30, callback) {
	let i = 0;
	let text = htmlText.replace(/<br\s*\/?>/gi, "\n"); // 줄바꿈 처리
	element.innerHTML = "";

	function type() {
		if (i < text.length) {
			if (text[i] === "\n") {
				element.innerHTML += "<br/>";
			} else {
				element.innerHTML += text[i];
			}
			i++;
			setTimeout(type, speed);
		} else if (callback) {
			callback();
		}
	}

	type();
}


function startLifeTimer() {
	const min = 3 * 60;
	const max = 5 * 60;
	gameState.timeLimit = Math.floor(Math.random() * (max - min + 1)) + min;
	gameState.timeRemaining = gameState.timeLimit;

	updateStatusBar(); // 시작 시 100%

	gameState.timerInterval = setInterval(() => {
		gameState.timeRemaining--;

		updateStatusBar();

		if (gameState.timeRemaining <= 0) {
			clearInterval(gameState.timerInterval);
			goToEpisode('ep_end');
		}
	}, 1000);
}



startBtn.addEventListener('click', async () => {
	// 노필터 삭제하기
	imageWrap.classList.remove('no_filter');
	gameTitle.style.display = 'none';
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





