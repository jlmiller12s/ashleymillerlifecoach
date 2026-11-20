/**
 * Ashley Miller Life Coach - Client-side Interactions
 * - Dynamic Homeroom Pricing (Nov 30 switch)
 * - Interactive Pop Quiz (8 Questions, 4 Eras)
 * - Mobile Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHomeroomPricing();
  initPopQuiz();
});

// Mobile navigation
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav');

  if (!hamburger || !nav) return;

  hamburger.addEventListener('click', () => {
    const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
    hamburger.setAttribute('aria-expanded', !isExpanded);
    hamburger.classList.toggle('active');
    nav.classList.toggle('active');
  });

  // Close nav on link click
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.classList.remove('active');
      nav.classList.remove('active');
    });
  });
}

// Homeroom Dynamic Pricing Block
function initHomeroomPricing() {
  const priceDisplay = document.getElementById('homeroom-price-value');
  const periodDisplay = document.getElementById('homeroom-period-value');
  const pillDisplay = document.getElementById('homeroom-pill');

  if (!priceDisplay) return;

  const now = new Date();
  // Founder deadline: end of Nov 30, 2026 local time
  const founderDeadline = new Date(2026, 10, 30, 23, 59, 59); // Month is 0-indexed: 10 = Nov

  if (now <= founderDeadline) {
    priceDisplay.textContent = '$47';
    if (periodDisplay) periodDisplay.innerHTML = 'full year access &middot; <strong style="color:var(--nps-magenta)">Founder rate through Nov 30, 2026</strong>';
    if (pillDisplay) pillDisplay.textContent = 'Founder Rate Available';
  } else {
    priceDisplay.textContent = '$97';
    if (periodDisplay) periodDisplay.innerHTML = 'full year access &middot; Annual enrollment';
    if (pillDisplay) {
      pillDisplay.textContent = 'Annual Access';
      pillDisplay.style.background = 'var(--nps-purple)';
    }
  }
}

// Interactive Pop Quiz: 8 questions, 4 Eras (Orientation, Clean Slate, Lesson Plan, Field Trip)
function initPopQuiz() {
  const quizContainer = document.getElementById('pop-quiz-app');
  if (!quizContainer) return;

  const questions = [
    {
      q: "When you think about the dream God put on your heart, what's your first reflex?",
      options: [
        { text: "I wonder if I'm even qualified or if I imagined it.", era: "orientation" },
        { text: "I feel guilty taking time away from everyone else.", era: "cleanslate" },
        { text: "I get excited, but I get overwhelmed because I don't know the exact steps.", era: "lessonplan" },
        { text: "I know what to do; I just need to get moving and stay accountable.", era: "fieldtrip" }
      ]
    },
    {
      q: "Where does your time and energy currently go most days?",
      options: [
        { text: "Surviving the schedule and putting out fires for others.", era: "orientation" },
        { text: "Saying yes to things out of habit, obligation, or people-pleasing.", era: "cleanslate" },
        { text: "Researching, planning, buying journals, but never quite launching.", era: "lessonplan" },
        { text: "Dipping my toes in, but feeling lonely or inconsistent doing it alone.", era: "fieldtrip" }
      ]
    },
    {
      q: "What does 'waiting for permission' look like in your life right now?",
      options: [
        { text: "Waiting until the kids are older, the budget is perfect, or life slows down.", era: "orientation" },
        { text: "Waiting for someone in my circle to say 'It's your turn, go for it.'", era: "cleanslate" },
        { text: "Waiting until I have the complete 10-step master roadmap figured out.", era: "lessonplan" },
        { text: "Waiting for the fear of failure or visibility to magically disappear.", era: "fieldtrip" }
      ]
    },
    {
      q: "If we had coffee today, what would you confess?",
      options: [
        { text: "I feel like I've lost touch with who Ashley / I actually am outside my roles.", era: "orientation" },
        { text: "I'm carrying emotional baggage or old failures that whisper I can't do this.", era: "cleanslate" },
        { text: "I have 50 ideas in my head and don't know which one to start with.", era: "lessonplan" },
        { text: "I'm ready. I just need a coach in my corner who won't let me back out.", era: "fieldtrip" }
      ]
    },
    {
      q: "What does your relationship with rest and self-care feel like?",
      options: [
        { text: "What rest? I crash only when my body forces me to.", era: "orientation" },
        { text: "Rest comes with a heavy side of guilt.", era: "cleanslate" },
        { text: "I schedule it, but work and chores always encroach on it.", era: "lessonplan" },
        { text: "I'm learning to protect my peace, but need better rhythms.", era: "fieldtrip" }
      ]
    },
    {
      q: "What kind of support sounds most life-giving to you right now?",
      options: [
        { text: "A reality check and an honest look at where I am without judgment.", era: "orientation" },
        { text: "Unpacking what to let go of so I can stop feeling depleted.", era: "cleanslate" },
        { text: "A concrete, step-by-step action plan tailored to my real life.", era: "lessonplan" },
        { text: "Weekly courage, community, and marching orders to keep going.", era: "fieldtrip" }
      ]
    },
    {
      q: "How does faith play into this next chapter for you?",
      options: [
        { text: "I know God has more, but I feel spiritually disconnected in the busyness.", era: "orientation" },
        { text: "I need to trust that God isn't mad at me for wanting to grow.", era: "cleanslate" },
        { text: "I want to align my practical daily plans with what God is doing.", era: "lessonplan" },
        { text: "I'm ready to walk in obedience even when my knees are shaking.", era: "fieldtrip" }
      ]
    },
    {
      q: "What would the best possible outcome be 6 months from now?",
      options: [
        { text: "Waking up with peace, clarity, and knowing who I am again.", era: "orientation" },
        { text: "Unburdened from expectations, guilt, and people's approval.", era: "cleanslate" },
        { text: "Holding a clear, written roadmap for my calling with real progress.", era: "lessonplan" },
        { text: "Fully living out my next chapter with confidence, joy, and community.", era: "fieldtrip" }
      ]
    }
  ];

  let currentStep = 0;
  const scores = { orientation: 0, cleanslate: 0, lessonplan: 0, fieldtrip: 0 };

  function renderQuestion() {
    if (currentStep >= questions.length) {
      renderResult();
      return;
    }

    const qData = questions[currentStep];
    const progress = Math.round(((currentStep + 1) / questions.length) * 100);

    quizContainer.innerHTML = `
      <div class="quiz-header">
        <span class="permission-slip-stamp">Pop Quiz: What's Your Next AssignMEANT?</span>
        <div class="quiz-progress-track">
          <div class="quiz-progress-fill" style="width: ${progress}%"></div>
        </div>
        <p style="font-size:13px; color:#666; margin-bottom:12px;">Question ${currentStep + 1} of ${questions.length}</p>
        <h3 style="font-size:clamp(18px, 2.5vw, 24px); color:var(--nps-teal); margin-bottom:20px;">${qData.q}</h3>
      </div>
      <div class="quiz-options-list">
        ${qData.options.map((opt, idx) => `
          <button type="button" class="quiz-option-btn" data-era="${opt.era}">
            <span style="font-weight:800; color:var(--nps-magenta);">${String.fromCharCode(65 + idx)}.</span>
            <span>${opt.text}</span>
          </button>
        `).join('')}
      </div>
    `;

    quizContainer.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const era = btn.getAttribute('data-era');
        scores[era] = (scores[era] || 0) + 1;
        btn.classList.add('selected');
        setTimeout(() => {
          currentStep++;
          renderQuestion();
        }, 220);
      });
    });
  }

  function renderResult() {
    let topEra = 'orientation';
    let highest = 0;
    for (const [era, score] of Object.entries(scores)) {
      if (score > highest) {
        highest = score;
        topEra = era;
      }
    }

    const eraDetails = {
      orientation: {
        title: "Era 1: Orientation",
        subtitle: "Getting Honest About Where You Are",
        description: "You've been in survive mode, pouring into everyone else while your own calling got parked. Good news: Class is in session, and the first step isn't sprinting—it's getting radically honest about what you actually want.",
        nextStep: "Grab the Free Guide or book a Clarity Call to stop waiting for someone else's permission.",
        ctaUrl: "/coaching",
        ctaText: "Explore 1:1 Coaching"
      },
      cleanslate: {
        title: "Era 2: Clean Slate",
        subtitle: "Releasing What Has Been Holding You Back",
        description: "You're carrying old obligations, mom guilt, and the weight of being everything to everyone. Your next chapter requires a clean chalkboard before you write the new lesson plan.",
        nextStep: "Join Homeroom or a Clarity Call to untangle the guilt and make room for what God put on your heart.",
        ctaUrl: "/homeroom",
        ctaText: "Check Out Homeroom"
      },
      lessonplan: {
        title: "Era 3: Lesson Plan",
        subtitle: "Building the Concrete Next Step",
        description: "You have dreams, ideas, and callings—what you need isn't another pep talk, it's a strategic, customized roadmap that fits into your actual 24-hour day.",
        nextStep: "Let's build your Personalized Next AssignMEANT Roadmap in 1:1 Coaching.",
        ctaUrl: "/coaching",
        ctaText: "View 1:1 Roadmap"
      },
      fieldtrip: {
        title: "Era 4: Field Trip",
        subtitle: "Taking Real Steps in Real Life",
        description: "You know where you want to go. Now it's about courage, sustained momentum, and surrounding yourself with women who won't let you shrink back.",
        nextStep: "You're primed for community and action! Join Homeroom or step into Rooted Women Collective.",
        ctaUrl: "/homeroom",
        ctaText: "Join Homeroom"
      }
    };

    const result = eraDetails[topEra] || eraDetails.orientation;

    quizContainer.innerHTML = `
      <div class="quiz-result-card">
        <span class="quiz-era-stamp">Your Reality Check Result</span>
        <h3 style="font-size:32px; color:var(--nps-teal); margin-bottom:6px;">${result.title}</h3>
        <p style="font-size:18px; font-weight:700; color:var(--nps-purple); margin-bottom:16px;">${result.subtitle}</p>
        <p style="font-size:15px; color:#4A5568; line-height:1.7; max-width:580px; margin:0 auto 24px;">${result.description}</p>
        <div style="background:var(--nps-pink-tint); border-radius:12px; padding:16px; margin-bottom:28px; max-width:580px; margin-left:auto; margin-right:auto;">
          <strong style="color:var(--nps-magenta); font-size:14px; text-transform:uppercase; letter-spacing:0.05em; display:block; margin-bottom:4px;">Ashley's Recommendation:</strong>
          <span style="font-size:14px; color:#2D3748;">${result.nextStep}</span>
        </div>
        <div style="display:flex; justify-content:center; gap:16px; flex-wrap:wrap;">
          <a href="${result.ctaUrl}" class="btn-magenta">${result.ctaText}</a>
          <a href="/book" class="btn-teal">Book a Free Clarity Call</a>
        </div>
        <div style="margin-top:24px;">
          <button type="button" id="retake-quiz-btn" style="background:none; border:none; color:#718096; text-decoration:underline; cursor:pointer; font-size:13px;">Retake the Quiz</button>
        </div>
      </div>
    `;

    document.getElementById('retake-quiz-btn')?.addEventListener('click', () => {
      currentStep = 0;
      scores.orientation = 0;
      scores.cleanslate = 0;
      scores.lessonplan = 0;
      scores.fieldtrip = 0;
      renderQuestion();
    });
  }

  renderQuestion();
}
