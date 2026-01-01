import type { ReactNode } from "react";

/* ---------------- Card ---------------- */
type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------------- Card Header ---------------- */
export function CardHeader({ children, className = "" }: CardProps) {
  return (
    <div className={`px-6 pt-6 pb-2 font-semibold ${className}`}>
      {children}
    </div>
  );
}

/* ---------------- Card Content ---------------- */
export function CardContent({ children, className = "" }: CardProps) {
  return (
    <div className={`px-6 py-4 text-gray-700 ${className}`}>
      {children}
    </div>
  );
}

/* ---------------- Card Footer ---------------- */
export function CardFooter({ children, className = "" }: CardProps) {
  return (
    <div className={`px-6 pb-6 pt-2 text-sm text-gray-500 ${className}`}>
      {children}
    </div>
  );
}
/* ---------------- Card Image ---------------- */
type CardImageProps = {
  src: string;
  alt?: string;
  className?: string;
};

export function CardImage({ src, alt = "", className = "" }: CardImageProps) {
  return (
    <div className={`w-full overflow-hidden rounded-t-2xl ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-48 object-cover transition-transform hover:scale-105"
      />
    </div>
  );
}

