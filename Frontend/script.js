// constants.js or at the top of your script
const BACKEND_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://boxdome-app.onrender.com/api'; // Updated to Render URL
const TMDB_API_KEY = '4065c93a0ae09813d967f09814854947'; // Your new TMDB API key

let movieData = {};

// Fetch movies from TMDB with category
async function fetchMovies(category) {
    console.log(`Fetching movies for ${category}`);
    const container = document.getElementById(`${category}Movies`);
    if (container) {
        container.innerHTML = '<p>Loading...</p>';
    }

    let url;
    try {
        if (category === 'latest') {
            url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
        } else if (category === 'hollywood') {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&with_original_language=en&sort_by=popularity.desc&page=1`;
        } else if (category === 'bollywood') {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&with_original_language=hi&sort_by=popularity.desc&page=1`;
        } else if (category === 'tollywood') {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&with_original_language=te&sort_by=popularity.desc&page=1`;
        } else {
            throw new Error(`Invalid category: ${category}`);
        }

        const response = await fetch(url);
        console.log(`Response for ${category}:`, response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${category} movies: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.results || !Array.isArray(data.results)) {
            throw new Error(`Invalid data format for ${category} movies`);
        }

        return data.results.map(movie => ({
            id: movie.id,
            title: movie.title,
            subtitle: `${new Date(movie.release_date).getFullYear()} • Genre`,
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A',
            img: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/200x250?text=No+Image',
            overview: movie.overview || 'No overview available.',
            category: category
        }));
    } catch (error) {
        console.error(`Error fetching ${category} movies:`, error);
        if (container) {
            container.innerHTML = '<p>Failed to load movies. Please try again later.</p>';
        }
        return [];
    }
}

// Fetch movie trailer from TMDB
async function fetchMovieTrailer(movieId) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
        const data = await response.json();
        if (response.ok && data.results && data.results.length > 0) {
            const trailer = data.results.find(video => video.type === 'Trailer' && video.site === 'YouTube') ||
                           data.results.find(video => video.type === 'Teaser' && video.site === 'YouTube') ||
                           data.results.find(video => video.site === 'YouTube');
            return trailer ? trailer.key : null;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching trailer for movie ID ${movieId}:`, error);
        return null;
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    console.log("script.js loaded successfully");
    // Ensure the mobile menu is closed on page load (for index.html)
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.remove('active');
    }

    // Fetch movies for all categories (for both index.html and dashboard.html)
    if (document.getElementById('latestMovies')) {
        movieData.latest = await fetchMovies('latest');
        loadMovies('latestMovies', movieData.latest.slice(0, 4));
    }
    if (document.getElementById('hollywoodMovies')) {
        movieData.hollywood = await fetchMovies('hollywood');
        loadMovies('hollywoodMovies', movieData.hollywood.slice(0, 4));
    }
    if (document.getElementById('bollywoodMovies')) {
        movieData.bollywood = await fetchMovies('bollywood');
        loadMovies('bollywoodMovies', movieData.bollywood.slice(0, 4));
    }
    if (document.getElementById('tollywoodMovies')) {
        movieData.tollywood = await fetchMovies('tollywood');
        loadMovies('tollywoodMovies', movieData.tollywood.slice(0, 4));
    }

    // Back to Top Button Visibility (for index.html)
    window.addEventListener('scroll', () => {
        const backToTop = document.getElementById('backToTop');
        if (backToTop) {
            if (window.scrollY > 300) {
                backToTop.style.display = 'block';
            } else {
                backToTop.style.display = 'none';
            }
        }
    });

    // Contact Form Submission (for index.html only)
    const contactForm = document.getElementById('contactForm');
    if (contactForm && window.location.pathname.includes('index.html')) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('contactName')?.value;
            const email = document.getElementById('contactEmail').value;
            const message = document.getElementById('contactMessage').value;

            if (!username || !email || !message) {
                showAlert('Please fill out all fields.', 'error');
                return;
            }

            try {
                const response = await fetch(`${BACKEND_URL}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, message })
                });

                const data = await response.json();
                if (response.ok) {
                    showAlert('Message sent successfully!', 'success');
                    contactForm.reset();
                } else {
                    showAlert('Failed to send message. Please try again later.', 'error');
                }
            } catch (error) {
                console.error('Error sending contact message:', error);
                showAlert('Failed to send message. Please try again later.', 'error');
            }
        });
    }

    // Dashboard: Load user info (for dashboard.html)
    if (document.getElementById('usernameDisplay')) {
        loadUserInfo();
    }

    // Dashboard: Apply saved settings (for dashboard.html)
    applySettings();

    // Index.html: Add event listener for search input
    const searchInput = document.querySelector('.search-container input');
    const searchButton = document.querySelector('.search-container button');
    if (searchInput && searchButton && window.location.pathname.includes('index.html')) {
        searchInput.addEventListener('input', searchMoviesIndex);
        searchButton.addEventListener('click', searchMoviesIndex);
    }

    // Dashboard.html: Add event listener for search input
    const dashboardSearchInput = document.getElementById('searchInput');
    if (dashboardSearchInput && window.location.pathname.includes('dashboard.html')) {
        dashboardSearchInput.addEventListener('input', searchMovies);
    }

    // Add event listeners for login and signup forms
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await login();
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await signup();
        });
    }
});

// Load movies (for both index.html and dashboard.html)
function loadMovies(containerId, movieList) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const token = localStorage.getItem('token');
    const isDashboard = document.getElementById('sidebar'); // Check if on dashboard

    movieList.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="${movie.img}" alt="${movie.title}">
            <h3>${movie.title}</h3>
            <p class="subtitle">${movie.subtitle}</p>
            <div class="info">
                <span>Rating:</span>
                <span class="rating">${movie.rating}</span>
            </div>
            ${isDashboard ? `<p class="overview">${movie.overview}</p>` : ''}
            <div class="buttons">
                <button onclick="${token && isDashboard ? `addToWishlist('${movie.id}', '${movie.title}', '${movie.img}', '${movie.subtitle}', '${movie.rating}', '${movie.overview}')` : `promptLogin('${movie.id}', '${movie.title}', '${movie.img}', 'wishlist')`}"><i class="fas fa-heart"></i> Favorite</button>
                <button onclick="${token && isDashboard ? `playTrailer('${movie.id}')` : `promptLogin('${movie.id}', '${movie.title}', '${movie.img}', 'trailer')`}"><i class="fas fa-play"></i> Trailer</button>
                ${isDashboard ? `<button onclick="showMovieDetails('${movie.id}', '${movie.title}', '${movie.img}', '${movie.subtitle}', '${movie.rating}', '${movie.overview}')"><i class="fas fa-info-circle"></i> Details</button>` : `<button onclick="${token ? `navigateTo('dashboard.html')` : `promptLogin('${movie.id}', '${movie.title}', '${movie.img}', 'details')`}"><i class="fas fa-info"></i> Details</button>`}
                ${isDashboard ? `<button onclick="showDownloadOptions('${movie.title}')"><i class="fas fa-download"></i> Download</button>` : ''}
                ${isDashboard ? `<button onclick="shareMovie('${movie.id}', '${movie.title}')"><i class="fas fa-share"></i> Share</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

// Index.html: Search Movies
async function searchMoviesIndex() {
    console.log("Searching movies on index.html");
    const query = document.querySelector('.search-container input').value.trim();
    const searchResultsSection = document.getElementById('searchResults');
    const searchResultsList = document.getElementById('searchResults');

    // Close mobile menu if open
    if (window.innerWidth <= 768) {
        const navLinks = document.getElementById('navLinks');
        if (navLinks && navLinks.classList.contains('active')) {
            toggleMenu();
        }
    }

    if (!query) {
        searchResultsSection.style.display = 'none';
        document.querySelectorAll('.movies').forEach(section => {
            section.style.display = 'block';
        });
        return;
    }

    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`);
        const movies = await response.json();

        if (response.ok) {
            searchResultsSection.style.display = 'grid';
            document.querySelectorAll('.movies').forEach(section => {
                section.style.display = 'none';
            });

            searchResultsList.innerHTML = '';

            if (!movies.results || movies.results.length === 0) {
                searchResultsList.innerHTML = '<p>No movies found.</p>';
                return;
            }

            const token = localStorage.getItem('token');
            for (const movie of movies.results) {
                const card = document.createElement('div');
                card.className = 'movie-card';
                const img = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/200x250?text=No+Image';
                const subtitle = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
                const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                const overview = movie.overview || 'No overview available.';
                card.innerHTML = `
                    <img src="${img}" alt="${movie.title}">
                    <h3>${movie.title}</h3>
                    <p class="subtitle">${subtitle} • Genre</p>
                    <div class="info">
                        <span>Rating:</span>
                        <span class="rating">${rating}</span>
                    </div>
                    <div class="buttons">
                        <button onclick="${token ? `addToWishlist('${movie.id}', '${movie.title}', '${img}', '${subtitle} • Genre', '${rating}', '${overview}')` : `promptLogin('${movie.id}', '${movie.title}', '${img}', 'wishlist')`}"><i class="fas fa-heart"></i> Favorite</button>
                        <button onclick="${token ? `playTrailer('${movie.id}')` : `promptLogin('${movie.id}', '${movie.title}', '${img}', 'trailer')`}"><i class="fas fa-play"></i> Trailer</button>
                        <button onclick="${token ? `navigateTo('dashboard.html')` : `promptLogin('${movie.id}', '${movie.title}', '${img}', 'details')`}"><i class="fas fa-info"></i> Details</button>
                    </div>
                `;
                searchResultsList.appendChild(card);
            }

            searchResultsSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            showAlert('Failed to search movies. Please try again later.', 'error');
            searchResultsList.innerHTML = '<p>Failed to load search results.</p>';
        }
    } catch (error) {
        console.error('Error searching movies on index.html:', error);
        showAlert('Error searching movies. Please try again later.', 'error');
        searchResultsList.innerHTML = '<p>Error loading search results.</p>';
    }
}

// Dashboard: Search Movies
async function searchMovies() {
    console.log("Searching movies on dashboard");
    const query = document.getElementById('searchInput').value.trim();
    const searchResultsSection = document.getElementById('searchResults');
    const searchResultsList = document.getElementById('searchResultsList');

    // Close sidebar on mobile when searching
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }

    if (!query) {
        searchResultsSection.style.display = 'none';
        showSection('home');
        return;
    }

    try {
        const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`);
        const movies = await response.json();

        if (response.ok) {
            searchResultsSection.style.display = 'block';
            showSection('searchResults');
            searchResultsList.innerHTML = '';

            if (!movies.results || movies.results.length === 0) {
                searchResultsList.innerHTML = '<p>No movies found.</p>';
                return;
            }

            for (const movie of movies.results) {
                const card = document.createElement('div');
                card.className = 'movie-card';
                const img = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/200x250?text=No+Image';
                const subtitle = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
                const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                const overview = movie.overview || 'No overview available.';
                card.innerHTML = `
                    <img src="${img}" alt="${movie.title}">
                    <h3>${movie.title}</h3>
                    <p class="subtitle">${subtitle} • Genre</p>
                    <div class="info">
                        <span>Rating:</span>
                        <span class="rating">${rating}</span>
                    </div>
                    <p class="overview">${overview}</p>
                    <div class="buttons">
                        <button onclick="addToWishlist('${movie.id}', '${movie.title}', '${img}', '${subtitle} • Genre', '${rating}', '${overview}')"><i class="fas fa-heart"></i> Favorite</button>
                        <button onclick="playTrailer('${movie.id}')"><i class="fas fa-play"></i> Trailer</button>
                        <button onclick="showMovieDetails('${movie.id}', '${movie.title}', '${img}', '${subtitle} • Genre', '${rating}', '${overview}')"><i class="fas fa-info-circle"></i> Details</button>
                        <button onclick="showDownloadOptions('${movie.title}')"><i class="fas fa-download"></i> Download</button>
                        <button onclick="shareMovie('${movie.id}', '${movie.title}')"><i class="fas fa-share"></i> Share</button>
                    </div>
                `;
                searchResultsList.appendChild(card);
            }
        } else {
            showAlert('Failed to search movies. Please try again later.', 'error');
            searchResultsList.innerHTML = '<p>Failed to load search results.</p>';
        }
    } catch (error) {
        console.error('Error searching movies:', error);
        showAlert('Error searching movies. Please try again later.', 'error');
        searchResultsList.innerHTML = '<p>Error loading search results.</p>';
    }
}

// Navigate to a URL
function navigateTo(url) {
    window.location.href = url;
}

// Dashboard: Toggle Sidebar
function toggleSidebar() {
    console.log("Toggling sidebar");
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const isMobile = window.innerWidth <= 768;

    if (sidebar) {
        sidebar.classList.toggle('active');
        if (!isMobile) {
            mainContent.classList.toggle('shifted');
        }
    }
}

// Dashboard: Navigate to Dashboard (Home Section)
function navigateToDashboard() {
    console.log("Navigating to dashboard");
    if (window.location.pathname.includes('dashboard.html')) {
        showSection('home');
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    } else {
        navigateTo('dashboard.html');
    }
}

// Dashboard: Show Section
function showSection(sectionId) {
    console.log(`Showing section: ${sectionId}`);
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.style.display = 'block';
    }

    // Load data for specific sections
    if (sectionId === 'myWishlist') {
        loadWishlist();
    } else if (sectionId === 'watchLater') {
        loadWatchLater();
    } else if (sectionId === 'adminPanel') {
        loadAdminPanel();
    } else if (sectionId === 'home') {
        fetchMovies('latest').then(movies => {
            movieData.latest = movies;
            loadMovies('latestMovies', movieData.latest.slice(0, 4));
        });
        fetchMovies('hollywood').then(movies => {
            movieData.hollywood = movies;
            loadMovies('hollywoodMovies', movieData.hollywood.slice(0, 4));
        });
        fetchMovies('bollywood').then(movies => {
            movieData.bollywood = movies;
            loadMovies('bollywoodMovies', movieData.bollywood.slice(0, 4));
        });
        fetchMovies('tollywood').then(movies => {
            movieData.tollywood = movies;
            loadMovies('tollywoodMovies', movieData.tollywood.slice(0, 4));
        });
    }

    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
}

async function loadUserInfo() {
    console.log("Loading user info");
    const token = localStorage.getItem('token');
    if (!token) {
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('User info response:', data);
        if (response.ok) {
            document.getElementById('usernameDisplay').textContent = data.username;
            document.getElementById('emailDisplay').textContent = data.email;
            document.getElementById('sidebarUsername').textContent = data.username;

            const userProfilePic = document.getElementById('userProfilePic');
            const userProfilePicDisplay = document.getElementById('userProfilePicDisplay');
            if (userProfilePic && data.profilePic) {
                userProfilePic.src = `${data.profilePic}?t=${new Date().getTime()}`; // Cache busting
                userProfilePic.onload = () => console.log('Profile pic loaded in profile:', userProfilePic.src);
                userProfilePic.onerror = () => {
                    console.error('Failed to load profile pic in profile:', userProfilePic.src);
                    userProfilePic.src = 'https://via.placeholder.com/80';
                };
            }
            if (userProfilePicDisplay && data.profilePic) {
                userProfilePicDisplay.src = `${data.profilePic}?t=${new Date().getTime()}`; // Cache busting
                userProfilePicDisplay.onload = () => console.log('Profile pic loaded in sidebar:', userProfilePicDisplay.src);
                userProfilePicDisplay.onerror = () => {
                    console.error('Failed to load profile pic in sidebar:', userProfilePicDisplay.src);
                    userProfilePicDisplay.src = 'https://via.placeholder.com/80';
                };
            }

            const joinDateDisplay = document.getElementById('joinDateDisplay');
            const wishlistCountDisplay = document.getElementById('wishlistCountDisplay');
            const watchLaterCountDisplay = document.getElementById('watchLaterCountDisplay');

            if (joinDateDisplay) {
                joinDateDisplay.textContent = 'N/A'; // Adjust based on backend response
            }
            const wishlistResponse = await fetch(`${BACKEND_URL}/wishlist`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const wishlistData = await wishlistResponse.json();
            if (wishlistCountDisplay) wishlistCountDisplay.textContent = wishlistData.wishlist.length || 0;

            const watchLaterResponse = await fetch(`${BACKEND_URL}/watchlater`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const watchLaterData = await watchLaterResponse.json();
            if (watchLaterCountDisplay) watchLaterCountDisplay.textContent = watchLaterData.watchLater.length || 0;
        } else {
            console.error('Failed to load user info:', data.message);
            document.getElementById('sidebarUsername').textContent = 'User';
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('sidebarUsername').textContent = 'User';
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

function setProfilePicture(event) {
    console.log("Setting profile picture");
    const file = event.target.files[0];
    if (!file) return;

    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Please log in to update your profile picture.', 'error');
        return;
    }

    // Immediately update the UI with the selected image (temporary)
    const profilePic = document.getElementById('userProfilePic');
    const profilePicDisplay = document.getElementById('userProfilePicDisplay');
    if (profilePic) profilePic.src = URL.createObjectURL(file);
    if (profilePicDisplay) profilePicDisplay.src = URL.createObjectURL(file);

    // Force backend URL and pre-flight check
    const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://boxdome-app.onrender.com'; // Updated to Render URL
    console.log('Forced Backend URL:', backendUrl);

    fetch(`${backendUrl}/`, { method: 'HEAD' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server unreachable. Status: ${response.status}`);
            }
            return true;
        })
        .catch(preFlightError => {
            console.error('Pre-flight Check Failed:', preFlightError);
            showAlert(`Server check failed: ${preFlightError.message}`, 'error');
            if (profilePic) profilePic.src = 'https://via.placeholder.com/80';
            if (profilePicDisplay) profilePicDisplay.src = 'https://via.placeholder.com/80';
            return false;
        })
        .then(isServerReachable => {
            if (!isServerReachable) return;

            const formData = new FormData();
            formData.append('profilePic', file);

            fetch(`${backendUrl}/api/update-profile-pic`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.message === 'Profile picture updated successfully') {
                    const newProfilePicUrl = data.profilePic;
                    console.log('New Profile Pic URL from server:', newProfilePicUrl);

                    if (profilePic) {
                        profilePic.src = `${newProfilePicUrl}?t=${new Date().getTime()}`;
                        profilePic.onload = () => console.log('Profile image loaded:', profilePic.src);
                        profilePic.onerror = () => {
                            console.error('Profile image failed to load:', profilePic.src);
                            showAlert('Failed to load new profile picture. Check server connection.', 'error');
                            profilePic.src = 'https://via.placeholder.com/80';
                        };
                    }
                    if (profilePicDisplay) {
                        profilePicDisplay.src = `${newProfilePicUrl}?t=${new Date().getTime()}`;
                        profilePicDisplay.onload = () => console.log('Display image loaded:', profilePicDisplay.src);
                        profilePicDisplay.onerror = () => {
                            console.error('Display image failed to load:', profilePicDisplay.src);
                            showAlert('Failed to load new profile picture in sidebar.', 'error');
                            profilePicDisplay.src = 'https://via.placeholder.com/80';
                        };
                    }

                    loadUserInfo().then(() => {
                        showAlert('Profile picture updated successfully!', 'success');
                    });
                } else {
                    throw new Error(data.message || 'Invalid response from server.');
                }
            })
            .catch(error => {
                console.error('Error uploading profile picture:', error);
                showAlert(`Failed to update profile picture on server. ${error.message}`, 'error');
                if (profilePic) profilePic.src = 'https://via.placeholder.com/80';
                if (profilePicDisplay) profilePicDisplay.src = 'https://via.placeholder.com/80';
            });
        });
}

function toggleEditUsername() {
    console.log("Toggling edit username");
    const usernameInput = document.getElementById('usernameInput');
    const saveUsernameBtn = document.getElementById('saveUsernameBtn');
    const editBtn = document.querySelector('#userProfile .edit-btn');

    if (usernameInput.style.display === 'none') {
        usernameInput.style.display = 'inline-block';
        saveUsernameBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';
        usernameInput.value = document.getElementById('usernameDisplay').textContent;
    } else {
        usernameInput.style.display = 'none';
        saveUsernameBtn.style.display = 'none';
        editBtn.style.display = 'inline-block';
    }
}

async function saveUsername() {
    console.log("Saving username");
    const newUsername = document.getElementById('usernameInput').value.trim();
    const token = localStorage.getItem('token');

    if (!newUsername) {
        showAlert('Username cannot be empty.', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/update-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username: newUsername, email: document.getElementById('emailDisplay').textContent })
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('usernameDisplay').textContent = newUsername;
            document.getElementById('sidebarUsername').textContent = newUsername;
            toggleEditUsername();
            showAlert('Username updated successfully!', 'success');
        } else {
            showAlert(data.message || 'Failed to update username.', 'error');
        }
    } catch (error) {
        console.error('Error updating username:', error);
        showAlert('Failed to update username. Please try again later.', 'error');
    }
}

async function loadWishlist() {
    console.log("Loading wishlist");
    const wishlistContainer = document.getElementById('wishlistMovies');
    wishlistContainer.innerHTML = '<p>Loading...</p>';

    const token = localStorage.getItem('token');
    if (!token) {
        wishlistContainer.innerHTML = '<p>Please log in to view your wishlist.</p>';
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/wishlist`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        wishlistContainer.innerHTML = '';
        if (response.ok) {
            if (!data.wishlist || data.wishlist.length === 0) {
                wishlistContainer.innerHTML = '<p>Your wishlist is empty.</p>';
                return;
            }

            data.wishlist.forEach(movie => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.innerHTML = `
                    <img src="${movie.movieImg}" alt="${movie.movieTitle}">
                    <h3>${movie.movieTitle}</h3>
                    <p class="subtitle">${'N/A'} • Genre</p>
                    <div class="info">
                        <span>Rating:</span>
                        <span class="rating">N/A</span>
                    </div>
                    <p class="overview">No overview available.</p>
                    <div class="buttons">
                        <button onclick="showDownloadOptions('${movie.movieTitle}')"><i class="fas fa-download"></i> Download</button>
                        <button onclick="playTrailer('${movie.movieId}')"><i class="fas fa-play"></i> Trailer</button>
                        <button onclick="removeFromWishlist('${movie.movieId}')"><i class="fas fa-trash"></i> Remove</button>
                        <button onclick="shareMovie('${movie.movieId}', '${movie.movieTitle}')"><i class="fas fa-share"></i> Share</button>
                    </div>
                `;
                wishlistContainer.appendChild(card);
            });
        } else {
            wishlistContainer.innerHTML = '<p>Failed to load wishlist. Please try again later.</p>';
        }
    } catch (error) {
        console.error('Error loading wishlist:', error);
        wishlistContainer.innerHTML = '<p>Failed to load wishlist. Please try again later.</p>';
    }
}

async function removeFromWishlist(movieId) {
    console.log(`Removing movie ${movieId} from wishlist`);
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Please log in to remove from wishlist.', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/wishlist`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ movieId })
        });
        const data = await response.json();
        if (response.ok) {
            showAlert('Removed from wishlist!', 'success');
            loadWishlist();
        } else {
            showAlert(data.message || 'Failed to remove from wishlist.', 'error');
        }
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        showAlert('Failed to remove from wishlist. Please try again later.', 'error');
    }
}

async function loadWatchLater() {
    console.log("Loading watch later");
    const watchLaterContainer = document.getElementById('watchLaterMovies');
    watchLaterContainer.innerHTML = '<p>Loading...</p>';

    const token = localStorage.getItem('token');
    if (!token) {
        watchLaterContainer.innerHTML = '<p>Please log in to view your watch later list.</p>';
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/watchlater`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        watchLaterContainer.innerHTML = '';
        if (response.ok) {
            if (!data.watchLater || data.watchLater.length === 0) {
                watchLaterContainer.innerHTML = '<p>Your watch later list is empty.</p>';
                return;
            }

            data.watchLater.forEach(movie => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.innerHTML = `
                    <img src="${movie.movieImg}" alt="${movie.movieTitle}">
                    <h3>${movie.movieTitle}</h3>
                    <p class="subtitle">${'N/A'} • Genre</p>
                    <div class="info">
                        <span>Rating:</span>
                        <span class="rating">N/A</span>
                    </div>
                    <p class="overview">No overview available.</p>
                    <div class="buttons">
                        <button onclick="addToWishlist('${movie.movieId}', '${movie.movieTitle}', '${movie.movieImg}', 'N/A • Genre', 'N/A', 'No overview available.')"><i class="fas fa-heart"></i> Favorite</button>
                        <button onclick="playTrailer('${movie.movieId}')"><i class="fas fa-play"></i> Trailer</button>
                        <button onclick="removeFromWatchLater('${movie.movieId}')"><i class="fas fa-trash"></i> Remove</button>
                        <button onclick="shareMovie('${movie.movieId}', '${movie.movieTitle}')"><i class="fas fa-share"></i> Share</button>
                    </div>
                `;
                watchLaterContainer.appendChild(card);
            });
        } else {
            watchLaterContainer.innerHTML = '<p>Failed to load watch later. Please try again later.</p>';
        }
    } catch (error) {
        console.error('Error loading watch later:', error);
        watchLaterContainer.innerHTML = '<p>Failed to load watch later. Please try again later.</p>';
    }
}

async function addToWatchLater(movieId, title, img, subtitle, rating, overview) {
    console.log(`Adding ${title} to watch later`);
    const token = localStorage.getItem('token');
    if (!token) {
        promptLogin(movieId, title, img, 'watchlater');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/watchlater`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ movieId, movieTitle: title, movieImg: img })
        });
        const data = await response.json();
        if (response.ok) {
            showAlert(`Successfully added "${title}" to watch later!`, 'success');
            if (document.getElementById('watchLater') && document.getElementById('watchLater').style.display === 'block') {
                loadWatchLater();
            }
        } else {
            showAlert(data.message || 'Failed to add to watch later.', 'error');
        }
    } catch (error) {
        console.error('Error adding to watch later:', error);
        showAlert('Failed to add to watch later. Please try again later.', 'error');
    }
}

async function removeFromWatchLater(movieId) {
    console.log(`Removing movie ${movieId} from watch later`);
    const token = localStorage.getItem('token');
    if (!token) {
        showAlert('Please log in to remove from watch later.', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/watchlater`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ movieId })
        });
        const data = await response.json();
        if (response.ok) {
            showAlert('Removed from watch later!', 'success');
            loadWatchLater();
        } else {
            showAlert(data.message || 'Failed to remove from watch later.', 'error');
        }
    } catch (error) {
        console.error('Error removing from watch later:', error);
        showAlert('Failed to remove from watch later. Please try again later.', 'error');
    }
}

async function loadAdminPanel() {
    console.log("Loading admin panel");
    const userList = document.getElementById('userList');
    userList.innerHTML = '<p>Loading...</p>';

    const token = localStorage.getItem('token');
    if (!token) {
        userList.innerHTML = '<p>Please login to access the admin panel.</p>';
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();

        if (response.ok) {
            userList.innerHTML = '';
            if (users.length === 0) {
                userList.innerHTML = '<p>No users found.</p>';
                return;
            }

            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.className = 'user-card';
                userCard.innerHTML = `
                    <h3>${user.username}</h3>
                    <p>Email: ${user.email}</p>
                    <p>Join Date: ${user.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}</p>
                    <p>Role: ${user.role || 'User'}</p>
                `;
                userList.appendChild(userCard);
            });
        } else {
            userList.innerHTML = '<p>Failed to load users. You may not have admin access.</p>';
        }
    } catch (error) {
        console.error('Error loading users:', error);
        userList.innerHTML = '<p>Failed to load users.</p>';
    }
}

const changePasswordForm = document.getElementById('changePasswordForm');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
        console.log("Changing password");
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        const token = localStorage.getItem('token');

        if (newPassword !== confirmNewPassword) {
            showAlert('New passwords do not match.', 'error');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();
            if (response.ok) {
                showAlert('Password changed successfully! Please log in again.', 'success');
                localStorage.removeItem('token');
                setTimeout(() => window.location.href = 'index.html', 2000);
            } else {
                showAlert(data.message || 'Failed to change password.', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showAlert('Failed to change password. Please try again later.', 'error');
        }
    });
}

let fontSize = 16;
function changeFontSize(action) {
    console.log(`Changing font size: ${action}`);
    if (action === 'increase' && fontSize < 24) {
        fontSize += 2;
    } else if (action === 'decrease' && fontSize > 12) {
        fontSize -= 2;
    }
    document.getElementById('fontSizeDisplay').textContent = `${fontSize}px`;
    document.body.style.fontSize = `${fontSize}px`;
}

function closeSettingsCard() {
    console.log("Closing settings card");
    const settingsCard = document.getElementById('settingsCard');
    settingsCard.classList.add('closing');
    setTimeout(() => {
        document.getElementById('settings').style.display = 'none';
        settingsCard.classList.remove('closing');
    }, 500);
}

function saveSettings() {
    console.log("Saving settings");
    const theme = document.getElementById('themeSelect').value;
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
    applySettings();
    showAlert('Settings saved successfully!', 'success');
}

function applySettings() {
    console.log("Applying settings");
    const savedTheme = localStorage.getItem('theme') || 'system';
    const savedFontSize = localStorage.getItem('fontSize') || 16;
    fontSize = parseInt(savedFontSize);
    const fontSizeDisplay = document.getElementById('fontSizeDisplay');
    if (fontSizeDisplay) {
        fontSizeDisplay.textContent = `${fontSize}px`;
    }
    document.body.style.fontSize = `${fontSize}px`;

    if (savedTheme === 'dark') {
        document.body.classList.remove('light-theme');
    } else if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }
    }

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

function logout() {
    console.log("Logging out");
    localStorage.removeItem('token');
    showAlert('Logout successful!', 'success');
    setTimeout(() => window.location.href = 'index.html', 2000);
}

async function addToWishlist(movieId, title, img, subtitle, rating, overview) {
    console.log(`Adding ${title} to wishlist`);
    const token = localStorage.getItem('token');
    if (!token) {
        promptLogin(movieId, title, img, 'wishlist');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/wishlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ movieId, movieTitle: title, movieImg: img })
        });
        const data = await response.json();
        if (response.ok) {
            showAlert(`Successfully added "${title}" to favorites!`, 'success');
            if (document.getElementById('myWishlist') && document.getElementById('myWishlist').style.display === 'block') {
                loadWishlist();
            }
        } else {
            showAlert(data.message || 'Failed to add to wishlist.', 'error');
        }
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        showAlert('Failed to add to wishlist. Please try again later.', 'error');
    }
}

async function playTrailer(movieId) {
    console.log(`Playing trailer for movie ${movieId}`);
    const trailerKey = await fetchMovieTrailer(movieId);
    if (trailerKey) {
        const modal = document.getElementById('trailerModal');
        const player = document.getElementById('trailerPlayer');
        player.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1" allowfullscreen></iframe>`;
        modal.style.display = 'flex';
    } else {
        showAlert('Trailer not available for this movie.', 'info');
    }
}

function showMovieDetails(id, title, img, subtitle, rating, overview) {
    console.log(`Showing details for ${title}`);
    const modal = document.getElementById('detailsModal');
    const detailsContainer = document.getElementById('movieDetails');
    detailsContainer.innerHTML = `
        <img src="${img}" alt="${title}">
        <h3>${title}</h3>
        <p>${subtitle}</p>
        <p>Rating: ${rating}</p>
        <p>${overview}</p>
    `;
    modal.style.display = 'flex';
}

function shareMovie(movieId, title) {
    console.log(`Sharing ${title}`);
    const shareLink = `https://www.themoviedb.org/movie/${movieId}`;
    navigator.clipboard.writeText(shareLink).then(() => {
        showAlert(`Link to "${title}" copied to clipboard!`, 'success');
    }).catch(err => {
        console.error('Error copying link:', err);
        showAlert('Failed to copy link.', 'error');
    });
}

function showDownloadOptions(movieTitle) {
    console.log(`Showing download options for ${movieTitle}`);
    const modal = document.getElementById('downloadOptionsModal');
    const titleElement = document.getElementById('downloadModalTitle');
    titleElement.textContent = `Download "${movieTitle}"`;
    modal.style.display = 'flex';
}

function showDownloadOptionsComingSoon() {
    console.log("Showing download options coming soon");
    const modal = document.getElementById('comingSoonModal');
    modal.style.display = 'flex';
}

function showComingSoon() {
    console.log("Showing coming soon");
    const modal = document.getElementById('comingSoonModal');
    modal.style.display = 'flex';
}

function closeModal() {
    console.log("Closing trailer modal");
    const modal = document.getElementById('trailerModal');
    modal.style.display = 'none';
    document.getElementById('trailerPlayer').innerHTML = '';
}

function closeDetailsModal() {
    console.log("Closing details modal");
    const modal = document.getElementById('detailsModal');
    modal.style.display = 'none';
    document.getElementById('movieDetails').innerHTML = '';
}

function closeDownloadModal() {
    console.log("Closing download modal");
    const modal = document.getElementById('downloadOptionsModal');
    modal.style.display = 'none';
}

function closeComingSoonModal() {
    console.log("Closing coming soon modal");
    const modal = document.getElementById('comingSoonModal');
    modal.style.display = 'none';
}

function promptLogin(movieId, title, img, action) {
    console.log(`Prompting login for ${action}`);
    localStorage.setItem('pendingAction', JSON.stringify({ movieId, title, img, action }));
    openAuthModal('login');
}

function showMoreMovies(category) {
    console.log(`Showing more movies for ${category}`);
    const container = document.getElementById(`${category}Movies`);
    const moreBtn = document.querySelector(`#${category} .more-btn`);
    const isExpanded = container.classList.contains('expanded');

    if (!isExpanded) {
        container.classList.add('expanded');
        loadMovies(`${category}Movies`, movieData[category]);
        moreBtn.textContent = 'Show Less';
    } else {
        container.classList.remove('expanded');
        loadMovies(`${category}Movies`, movieData[category].slice(0, 4));
        moreBtn.textContent = 'More Movies';
        document.getElementById(category).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function toggleMenu() {
    console.log("Toggling menu");
    const navLinks = document.getElementById('navLinks');
    const isMobile = window.innerWidth <= 768;

    if (navLinks) {
        navLinks.classList.toggle('active');

        if (isMobile) {
            const existingCloseMark = navLinks.querySelector('.close-menu');
            if (navLinks.classList.contains('active')) {
                if (!existingCloseMark) {
                    const closeMark = document.createElement('span');
                    closeMark.className = 'close-menu';
                    closeMark.textContent = '×';
                    closeMark.onclick = toggleMenu;
                    navLinks.appendChild(closeMark);
                }
            } else {
                if (existingCloseMark) {
                    existingCloseMark.remove();
                }
            }
        }
    }
}

function scrollToSection(sectionId) {
    console.log(`Scrolling to section: ${sectionId}`);
    const section = document.getElementById(sectionId);
    if (section) {
        const headerHeight = document.querySelector('header').offsetHeight;
        const sectionPosition = section.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({
            top: sectionPosition,
            behavior: 'smooth'
        });
        if (window.innerWidth <= 768) {
            if (document.getElementById('sidebar')) {
                toggleSidebar();
            } else {
                toggleMenu();
            }
        }
    }
}

function scrollToTop() {
    console.log("Scrolling to top");
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshPage() {
    console.log("Refreshing page");
    if (window.location.pathname.includes('index.html')) {
        window.location.reload();
    } else if (window.location.pathname.includes('dashboard.html')) {
        window.location.reload();
    }
}

function refreshToHome() {
    console.log("Refreshing to home");
    if (window.location.pathname.includes('dashboard.html')) {
        showSection('home');
    } else {
        navigateTo('index.html');
    }
}

function openAuthModal(type) {
    console.log(`Opening auth modal for ${type}`);
    const modal = document.getElementById('authModal');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (modal && loginForm && signupForm) {
        modal.style.display = 'flex';
        loginForm.style.display = type === 'login' ? 'block' : 'none';
        signupForm.style.display = type === 'signup' ? 'block' : 'none';
    } else {
        console.error('Auth modal elements not found');
    }
}

function closeAuthModal() {
    console.log("Closing auth modal");
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showSignup() {
    console.log("Showing signup form");
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm && signupForm) {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
}

function showLogin() {
    console.log("Showing login form");
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm && signupForm) {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    }
}

async function login() {
    console.log("Attempting login");
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const authMessage = document.getElementById('authMessage');

    if (!loginUsername || !loginPassword) {
        showAlert('Login form elements are missing.', 'error');
        return;
    }

    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    if (!username || !password) {
        showAlert('Please fill out all fields.', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Login response:', { status: response.status, data });

        if (response.ok) {
            localStorage.setItem('token', data.token);
            showAlert('Login successful!', 'success');
            closeAuthModal();

            const pendingAction = JSON.parse(localStorage.getItem('pendingAction'));
            if (pendingAction) {
                const { movieId, title, img, action } = pendingAction;
                try {
                    if (action === 'wishlist') {
                        await addToWishlist(movieId, title, img, `${new Date().getFullYear()} • Genre`, 'N/A', 'No overview available.');
                    } else if (action === 'trailer') {
                        await playTrailer(movieId);
                    } else if (action === 'details') {
                        navigateTo('dashboard.html');
                    } else if (action === 'watchlater') {
                        await addToWatchLater(movieId, title, img, `${new Date().getFullYear()} • Genre`, 'N/A', 'No overview available.');
                    }
                } catch (actionError) {
                    console.error(`Failed to execute pending action ${action}:`, actionError);
                    showAlert(`Failed to perform ${action} action. Please try again.`, 'error');
                }
                localStorage.removeItem('pendingAction');
            } else {
                navigateTo('dashboard.html');
            }
        } else {
            if (authMessage) {
                authMessage.textContent = data.message || 'Invalid credentials or server error';
            }
            showAlert(data.message || 'Login failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Network error during login:', error);
        showAlert('Unable to connect to the server. Please check your network and try again.', 'error');
    }
}

async function signup() {
    console.log("Attempting signup");
    const signupUsername = document.getElementById('signupUsername');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const signupMessage = document.getElementById('signupMessage');

    if (!signupUsername || !signupEmail || !signupPassword || !confirmPassword) {
        showAlert('Signup form elements are missing.', 'error');
        return;
    }

    const username = signupUsername.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value.trim();
    const confirmPass = confirmPassword.value.trim();

    if (!username || !email || !password || !confirmPass) {
        showAlert('Please fill out all fields.', 'error');
        return;
    }
    if (password !== confirmPass) {
        showAlert('Passwords do not match.', 'error');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        console.log('Signup response:', { status: response.status, data });

        if (response.ok) {
            showAlert('Sign up successful! Please log in.', 'success');
            showLogin();
            const signupForm = document.getElementById('signupForm');
            if (signupForm) signupForm.reset(); // Clear form
        } else {
            if (signupMessage) {
                signupMessage.textContent = data.message || 'Signup failed. Please try again.';
            }
            showAlert(data.message || 'Signup failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Network error during signup:', error);
        showAlert('Unable to connect to the server. Please check your network and try again.', 'error');
    }
}

function showAlert(text, type) {
    console.log(`Showing alert: ${text}, type: ${type}`);
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = text;
    alert.style.position = 'fixed';
    alert.style.top = '20px';
    alert.style.right = '20px';
    alert.style.padding = '10px 20px';
    alert.style.borderRadius = '5px';
    alert.style.zIndex = '1000';
    alert.style.maxWidth = '300px';
    alert.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    if (type === 'success') {
        alert.style.backgroundColor = '#4CAF50';
        alert.style.color = '#fff';
    } else if (type === 'error') {
        alert.style.backgroundColor = '#f44336';
        alert.style.color = '#fff';
    } else {
        alert.style.backgroundColor = '#2196F3';
        alert.style.color = '#fff';
    }
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
} // Fixed truncation by adding closing bracket