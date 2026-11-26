// SVG geometry and copy from owner-approved BusyDoo-launch.html, concept 04.
export default function BusyDooLaunchArtwork() {
  return (
    <svg viewBox="0 0 360 640" role="img" aria-label="Planning, habits, goals and finances come together. BusyDoo. Life, in one place." className="busydoo-launch-cinematic" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ambient">
          <stop offset="0" stop-color="#293d2c" />
          <stop offset=".6" stop-color="#18251d" />
          <stop offset="1" stop-color="#101513" />
        </radialGradient>
        <linearGradient id="sage" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#B6D69A" />
          <stop offset="1" stop-color="#91BA70" />
        </linearGradient>
        <linearGradient id="cream" x1="0" y1="0" x2=".7" y2="1">
          <stop stop-color="#FFFCF2" />
          <stop offset="1" stop-color="#E9E5D7" />
        </linearGradient>
        <mask id="orbitmask">
          <path id="orbitdraw" pathLength="1" d="M132 359C67 366 76 323 119 302M163 333C220 312 296 279 246 255" stroke="white" strokeWidth="24" strokeLinecap="round" fill="none" />
        </mask>
      </defs>
      <rect width="360" height="640" fill="#101513" />
      <ellipse id="glow" cx="180" cy="300" rx="210" ry="240" fill="url(#ambient)" opacity=".8" />
      <g id="intro" opacity="0" textAnchor="middle">
        <text x="180" y="62" fill="#94AC98" fontSize="10" letterSpacing="3">THE EVERYDAY</text>
        <text x="180" y="91" fill="#F7F5EC" fontSize="23" fontWeight="600" letterSpacing="-.9">Life has many moving parts.</text>
      </g>
      <g id="connections" fill="none" stroke="#6D9873" strokeWidth="1.2" opacity="0">
        <path pathLength="1" d="M88 174C88 248 272 146 272 220S75 313 85 403S271 408 273 465" />
        <circle cx="170" cy="214" r="3" fill="#99BE90" stroke="none" />
        <circle cx="181" cy="321" r="3" fill="#99BE90" stroke="none" />
      </g>
      <g className="piece" transform="translate(145 264)">
        <g className="card" opacity="0">
          <rect x="-64" y="-62" width="128" height="124" rx="23" fill="#202C24" stroke="#39493C" strokeWidth=".8" />
        </g>
        <g className="tile">
          <path d="M-32 0C-32-19-18-32 1-32H8C22-32 32-22 32-7V32H-8C-23 32-32 19-32 0Z" fill="url(#cream)" />
          <g stroke="#17221C" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="-16" y="-11" width="32" height="28" rx="5" />
            <path d="M-8-16V-8M8-16V-8M-15-3H15" />
          </g>
          <g id="date" opacity="0">
            <rect x="-4" y="2" width="8" height="8" rx="2.5" fill="#709A58" />
          </g>
        </g>
        <g className="copy" opacity="0" textAnchor="middle">
          <text className="moment-label" y="18">PLAN</text>
          <text className="moment-title" y="36">Make time.</text>
          <text className="moment-detail" y="51">For what matters.</text>
        </g>
      </g>
      <g className="piece" transform="translate(215 264)">
        <g className="card" opacity="0">
          <rect x="-64" y="-62" width="128" height="124" rx="23" fill="#26382B" stroke="#455B43" strokeWidth=".8" />
        </g>
        <g className="tile">
          <path d="M-32-6C-32-21-21-32-5-32H4C21-32 32-18 32 0C32 19 18 32 0 32H-32Z" fill="url(#sage)" />
          <path id="check" pathLength="1" d="M-15-1L-5 10L16-12" fill="none" stroke="#17221C" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g className="copy" opacity="0" textAnchor="middle">
          <text className="moment-label" y="18">HABITS & TASKS</text>
          <text className="moment-title" y="36">Show up.</text>
          <text className="moment-detail" y="51">One small step at a time.</text>
        </g>
      </g>
      <g className="piece" transform="translate(145 334)">
        <g className="card" opacity="0">
          <rect x="-64" y="-62" width="128" height="124" rx="23" fill="#202C24" stroke="#39493C" strokeWidth=".8" />
        </g>
        <g className="tile">
          <path d="M-4-32H32V0C32 19 19 32 0 32C-19 32-32 19-32 0C-32-19-19-32-4-32Z" fill="url(#cream)" />
          <g fill="#17221C">
            <rect className="bar" data-h="15" x="-17" y="3" width="9" height="15" rx="4.5" />
            <rect className="bar" data-h="25" x="-4.5" y="-7" width="9" height="25" rx="4.5" />
            <rect className="bar" data-h="37" x="8" y="-19" width="9" height="37" rx="4.5" />
          </g>
        </g>
        <g className="copy" opacity="0" textAnchor="middle">
          <text className="moment-label" y="18">GOALS</text>
          <text className="moment-title" y="36">Move forward.</text>
          <text className="moment-detail" y="51">Make progress visible.</text>
        </g>
      </g>
      <g className="piece" transform="translate(215 334)">
        <g className="card" opacity="0">
          <rect x="-64" y="-62" width="128" height="124" rx="23" fill="#202C24" stroke="#39493C" strokeWidth=".8" />
        </g>
        <g className="tile">
          <path d="M-32-32H0C19-32 32-18 32 0C32 19 19 32 0 32C-19 32-32 19-32 0Z" fill="url(#cream)" />
          <g id="coin" opacity="0">
            <circle cx="0" cy="-19" r="9" fill="#9EC480" stroke="#17221C" strokeWidth="2" />
            <path d="M0-23V-15" stroke="#17221C" strokeWidth="2" strokeLinecap="round" />
          </g>
          <path d="M-16-12H11Q18-12 18-5H5Q-3-5-3 2Q-3 10 5 10H18V12Q18 17 11 17H-16Q-20 17-20 11V-6Q-20-12-16-12Z" fill="#17221C" />
          <circle cx="5" cy="2" r="3.2" fill="#17221C" />
        </g>
        <g className="copy" opacity="0" textAnchor="middle">
          <text className="moment-label" y="18">MONEY</text>
          <text className="moment-title" y="36">Stay in control.</text>
          <text className="moment-detail" y="51">Every penny has a place.</text>
        </g>
      </g>
      <g id="orbit" mask="url(#orbitmask)" fill="url(#sage)">
        <path d="M119 302C64 328 74 375 132 359C91 357 87 332 119 302Z" />
        <path d="M163 336C226 322 304 281 246 255C277 289 218 310 163 336Z" />
      </g>
      <g id="brand" textAnchor="middle">
        <text x="180" y="430" fontSize="53" fontWeight="800" letterSpacing="-3.5" fill="#FAF8EF">BusyD<tspan fill="#ACD08E">oo</tspan></text>
        <text id="tagline" x="180" y="464" fontSize="14" letterSpacing=".9" fill="#C2CEC0">Life, in one place.</text>
      </g>
    </svg>
  );
}
