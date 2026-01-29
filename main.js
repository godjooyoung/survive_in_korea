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

// 스토리데이터 불러오는 함수
async function loadStory() {
  const res = await fetch("/data/story.json", { cache: "no-store" });
  if (!res.ok) throw new Error("story.json load failed");
  STORY = await res.json();
}

// 초기 돔 로드
async function init() {
  await loadStory();
  gameState.currentId = STORY.start;
  renderNode(gameState.currentId);
}

// 게임 시작 버튼 클릭 핸들러
function startGame() {
	// 3~8분 사이의 랜덤 시간 (초 단위)
	gameState.timeLimit = Math.floor(Math.random() * (8 - 3 + 1) + 3) * 60;
	gameState.timeRemaining = gameState.timeLimit;

	// 화면 전환
	document.getElementById('title-screen').style.display = 'none';
	document.getElementById('game-screen').style.display = 'block';
	document.querySelector('.container').classList.remove('title-active');

	// 타이머 시작
	startTimer();

	// 첫 스토리 표시
	showCurrentStory();

	// 스크롤 이벤트 리스너
	window.addEventListener('scroll', handleScroll);

	// 키보드 이벤트 리스너
	document.addEventListener('keydown', handleKeyboard);
}

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

// 현재 스토리 표시
function showCurrentStory() {
	const currentStory = storyData[gameState.currentStage];

	if (!currentStory) {
		endGame('당신은 모든 시련을 극복하고 안전한 곳에 도착했습니다!');
		return;
	}

	// 일러스트와 텍스트 업데이트
	document.getElementById('illustration').textContent = currentStory.illustration;
	document.getElementById('story-text').textContent = currentStory.text;

	// 선택지가 있는 경우
	if (currentStory.isChoice) {
		document.getElementById('scroll-hint').style.display = 'none';
		showChoices(currentStory.choices);
	} else {
		document.getElementById('scroll-hint').style.display = 'block';
		hideChoices();
	}

	// 스탯 업데이트
	updateStats();
}

// 선택지 표시
function showChoices(choices) {
	const container = document.getElementById('choices-container');
	container.style.display = 'grid';

	const buttons = container.querySelectorAll('.choice-button');
	buttons.forEach((button, index) => {
		if (choices[index]) {
			button.style.display = 'block';
			button.querySelector('.choice-text').textContent = choices[index].text;
			button.onclick = () => selectChoice(index);
		} else {
			button.style.display = 'none';
		}
	});

	// 첫 번째 선택지 선택
	gameState.selectedChoiceIndex = 0;
	updateSelectedChoice();
}

// 선택지 숨기기
function hideChoices() {
	document.getElementById('choices-container').style.display = 'none';
}

// 선택지 선택
function selectChoice(index) {
	const currentStory = storyData[gameState.currentStage];
	const choice = currentStory.choices[index];

	// 효과 적용
	gameState.survival += choice.effect.survival;
	gameState.distance += choice.effect.distance;
	gameState.decisions++;

	// 생존력 체크
	if (gameState.survival <= 0) {
		endGame('생존력이 바닥났습니다. 당신은 더 이상 버틸 수 없었습니다.');
		return;
	}

	// 다음 스테이지로
	gameState.currentStage++;
	showCurrentStory();

	// 맨 위로 스크롤
	window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 스크롤 핸들러
function handleScroll() {
	const currentStory = storyData[gameState.currentStage];

	// 선택지가 없는 경우에만 스크롤로 진행
	if (!currentStory.isChoice) {
		const scrollHeight = document.documentElement.scrollHeight;
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const clientHeight = document.documentElement.clientHeight;

		// 스크롤이 하단 근처에 도달하면 다음 스테이지
		if (scrollTop + clientHeight >= scrollHeight - 50) {
			gameState.currentStage++;
			showCurrentStory();
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
}

// 키보드 핸들러
function handleKeyboard(e) {
	const currentStory = storyData[gameState.currentStage];

	if (!currentStory.isChoice) return;

	const choices = currentStory.choices;

	if (e.key === 'ArrowUp') {
		e.preventDefault();
		gameState.selectedChoiceIndex = Math.max(0, gameState.selectedChoiceIndex - 1);
		updateSelectedChoice();
	} else if (e.key === 'ArrowDown') {
		e.preventDefault();
		gameState.selectedChoiceIndex = Math.min(choices.length - 1, gameState.selectedChoiceIndex + 1);
		updateSelectedChoice();
	} else if (e.key === 'Enter') {
		e.preventDefault();
		selectChoice(gameState.selectedChoiceIndex);
	}
}

// 선택된 선택지 업데이트
function updateSelectedChoice() {
	const buttons = document.querySelectorAll('.choice-button');
	buttons.forEach((button, index) => {
		if (index === gameState.selectedChoiceIndex) {
			button.classList.add('selected');
		} else {
			button.classList.remove('selected');
		}
	});
}

// 스탯 업데이트
function updateStats() {
	document.getElementById('survival-stat').textContent = Math.max(0, gameState.survival);
	document.getElementById('distance-stat').textContent = gameState.distance + 'km';
	document.getElementById('decision-stat').textContent = gameState.decisions;
}

// 게임 종료
function endGame(message) {
	clearInterval(gameState.timerInterval);

	document.getElementById('game-screen').style.display = 'none';
	document.getElementById('ending-screen').style.display = 'block';

	// 엔딩 메시지 결정
	let endingTitle = '게임 오버';
	let endingMessage = message;

	if (gameState.survival > 0 && gameState.currentStage >= storyData.length - 1) {
		endingTitle = '생존 성공!';
		endingMessage = `축하합니다! ${gameState.distance}km를 이동하며 ${gameState.decisions}개의 결정을 내렸습니다. 당신은 한국에서 살아남았습니다.`;
	}

	document.getElementById('ending-title').textContent = endingTitle;
	document.getElementById('ending-text').textContent = endingMessage;

	// 이벤트 리스너 제거
	window.removeEventListener('scroll', handleScroll);
	document.removeEventListener('keydown', handleKeyboard);
}
