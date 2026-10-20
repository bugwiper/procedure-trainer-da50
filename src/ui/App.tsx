export function App() {
  return (
    <div class="stage">
      <svg
        class="panel-svg"
        data-testid="panel"
        viewBox="0 0 2000 1010"
        preserveAspectRatio="xMidYMid meet"
        aria-label="DA50 RG instrument panel"
      >
        <rect
          data-testid="panel-background"
          x="0"
          y="0"
          width="2000"
          height="1010"
          fill="#14171c"
        />
      </svg>
      <footer class="footer">
        <span data-testid="training-aid-notice">Training aid only, not the AFM</span>
      </footer>
    </div>
  );
}
