// Renders SVG markup built by lib/garments (all user text is escaped there; paths are validated).
export default function Svg({ markup, className = "" }: { markup: string; className?: string }) {
  return <div className={`svg-fill ${className}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
