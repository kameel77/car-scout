import React, { useEffect } from 'react';

export interface BenefivoModalProps {
  isOpen: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export const BenefivoModal: React.FC<BenefivoModalProps> = ({
  isOpen,
  onClose,
  kicker,
  title,
  description,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="benefivo-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="benefivo-dialog-title"
    >
      <div className="benefivo-dialog-panel">
        <button
          type="button"
          className="benefivo-dialog-close"
          onClick={onClose}
          aria-label="Zamknij okno"
        >
          ✕
        </button>
        <p className="eyebrow">{kicker}</p>
        <h2 id="benefivo-dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="benefivo-dialog-body mt-4">{children}</div>
      </div>
    </div>
  );
};
