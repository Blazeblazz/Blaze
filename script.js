document.addEventListener('DOMContentLoaded', () => {
    const infoBoxes = document.querySelectorAll('.info-box');
    const logo = document.querySelector('.logo');
    const scrollbarThumb = document.querySelector('.scrollbar-thumb');
    const navDots = document.querySelectorAll('.nav-dot');
    const sections = document.querySelectorAll('.hero-section');
    const loader = document.querySelector('.loader');
    
    // Create Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Update navigation if it's a section
                if (entry.target.tagName === 'SECTION') {
                    const id = entry.target.getAttribute('id');
                    navDots.forEach(dot => {
                        dot.classList.remove('active');
                        if (dot.getAttribute('href') === `#${id}`) {
                            dot.classList.add('active');
                        }
                    });
                }
            } else {
                entry.target.classList.remove('visible');
            }
        });
    }, {
        threshold: 0.5
    });

    // Observe all sections and info boxes
    sections.forEach(section => {
        observer.observe(section);
    });
    infoBoxes.forEach(box => {
        observer.observe(box);
    });
    observer.observe(logo);

    // Custom scrollbar functionality
    function updateScrollbar() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY;
        
        // Calculate scroll progress (0 to 1)
        const scrollProgress = scrollTop / (documentHeight - windowHeight);
        
        // Calculate how far the thumb should move within its container
        const maxScroll = 100 - 20; // 100px container height - 20px thumb height
        const thumbPosition = scrollProgress * maxScroll;
        
        // Set fixed height for thumb
        scrollbarThumb.style.height = '20px';
        // Move thumb within container
        scrollbarThumb.style.transform = `translateY(${thumbPosition}px)`;
    }

    // Update scrollbar on scroll
    window.addEventListener('scroll', updateScrollbar);
    // Initial update
    updateScrollbar();

    // Smooth scroll for navigation
    navDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = dot.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Add event listeners for order buttons
    const orderButtons = document.querySelectorAll('.order-button');
    orderButtons.forEach(button => {
        button.addEventListener('click', handleOrderButtonClick);
        button.addEventListener('touchstart', handleOrderButtonClick);
    });
    
    // Smooth scroll for discover links
    const discoverLinks = document.querySelectorAll('.discover-link');
    discoverLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Hide loader after animation completes
    setTimeout(() => {
        loader.classList.add('hidden');
    }, 2000);

    // Scroll velocity animation
    const velocityText = document.querySelector('.velocity-text');
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateVelocity() {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY;
        const velocity = Math.min(Math.abs(scrollDelta) * 0.1, 30);
        
        if (velocityText) {
            velocityText.style.transform = `rotateX(${scrollDelta * 0.1}deg) translateZ(${velocity}px)`;
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateVelocity);
            ticking = true;
        }
    });
}); 