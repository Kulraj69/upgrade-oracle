export function NightScene() {
  return (
    <div className="night-scene" aria-hidden="true">
      <div className="stars" />
      <div className="moon">
        <span />
      </div>
      <svg
        className="mountains"
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="mountain-fade" x2="0" y2="1">
            <stop stopColor="#344568" />
            <stop offset="1" stopColor="#111c34" />
          </linearGradient>
        </defs>
        <path
          d="M0 230 90 170 180 233 325 65 430 170 510 110 660 270 820 164 930 280 1090 80 1185 160 1260 112 1400 255 1500 168 1600 228V600H0Z"
          fill="url(#mountain-fade)"
        />
        <path
          d="m180 233 145-168 105 105-74-38-27-35-38 68-24-7-30 53-23-4Zm330-123-49 83 42-29 24 19 52 16Zm-420 60-54 75 50-32 25 7 22-18Zm1000-90-86 124 55-23 28-50 29 45 39-5Zm170 32-74 101 43-34 34 9 22-19 40 28Z"
          fill="#7d91b4"
          opacity=".55"
        />
        <path
          d="M0 357 190 290 345 379 560 257 785 382 988 290 1180 355 1410 275 1600 320V600H0Z"
          fill="#111a2b"
        />
        <path
          d="M0 466 260 390 470 438 722 375 1000 467 1220 400 1600 390V600H0Z"
          fill="#0b1321"
        />
      </svg>
      <svg
        className="ruins"
        viewBox="0 0 1600 650"
        preserveAspectRatio="xMidYMax slice"
      >
        <g fill="#222d3b" stroke="#344052" strokeWidth="2">
          <path d="M30 650V357H48V333H36V314H126V334H117V355H130V650ZM50 312V180L66 163 64 149 95 145 103 172H118V312Z" />
          <path d="M1430 650V257H1440V229H1430V208H1531V228H1523V258H1535V650ZM1444 204V113H1460V72L1481 59 1502 68 1518 103V204Z" />
          <path d="M1373 650V419H1378V402H1440V419H1449V650Z" />
          <path d="M0 640 21 591 44 599 65 568 109 591 148 581 187 625 232 619 246 650ZM1360 650 1374 611 1403 598 1438 627 1484 611 1525 587 1559 606 1600 590V650Z" />
        </g>
        <g stroke="#637085" opacity=".22" strokeWidth="3">
          <path d="M63 365V575m18-210v214m20-214v214m1360-306v297m18-297v297m18-297v297" />
          <path d="m53 214 32 17-7 24m1387-119 31 13-8 39M45 437h76m1337-48h60" />
        </g>
      </svg>
      <div className="film-grain" />
    </div>
  );
}
