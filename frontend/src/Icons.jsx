import React from "react";

export function Icon({ path, size = 16, className = "", ariaHidden = true, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`.trim()}
      aria-hidden={ariaHidden ? "true" : undefined}
      {...props}
    >
      {path}
    </svg>
  );
}

export const CheckIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polyline points="20 6 9 17 4 12" />
      </>
    }
  />
);

export const CheckCircleIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    }
  />
);

export const CloseIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    }
  />
);

export const SearchIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    }
  />
);

export const FilterIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </>
    }
  />
);

export const EditIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    }
  />
);

export const CopyIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    }
  />
);

export const DownloadIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    }
  />
);

export const InfoIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </>
    }
  />
);

export const ChevronLeftIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polyline points="15 18 9 12 15 6" />
      </>
    }
  />
);

export const ChevronRightIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polyline points="9 18 15 12 9 6" />
      </>
    }
  />
);

export const UploadCloudIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
      </>
    }
  />
);

export const FileIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    }
  />
);

export const FilePdfIcon = ({ size = 16, className = "" }) => (
  <span className={`file-badge file-badge-pdf ${className}`} style={{ width: size, height: size }}>
    PDF
  </span>
);

export const FileDocxIcon = ({ size = 16, className = "" }) => (
  <span className={`file-badge file-badge-docx ${className}`} style={{ width: size, height: size }}>
    DOC
  </span>
);

export const TrashIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    }
  />
);

export const UsersIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    }
  />
);

export const CompareIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    }
  />
);

export const StarIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </>
    }
  />
);

export const AlertCircleIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    }
  />
);

export const SparklesIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
      </>
    }
  />
);

export const AwardIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <circle cx="12" cy="8" r="7" />
        <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
      </>
    }
  />
);

export const ArrowUpDownIcon = (props) => (
  <Icon
    {...props}
    path={
      <>
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </>
    }
  />
);
