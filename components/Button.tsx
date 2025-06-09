import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg'; // Added size prop
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', ...props }) => {
  const baseStyle = "rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm transition ease-in-out duration-150";
  
  const primaryStyle = "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500";
  const secondaryStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400";

  let sizeStyle = "";
  switch (size) {
    case 'sm':
      sizeStyle = "px-3 py-1.5 text-xs";
      break;
    case 'md':
      sizeStyle = "px-4 py-2 text-sm";
      break;
    case 'lg':
      sizeStyle = "px-6 py-3 text-base";
      break;
    default:
      sizeStyle = "px-4 py-2 text-sm"; // Default to md
  }

  return (
    <button
      {...props}
      className={`${baseStyle} ${sizeStyle} ${variant === 'primary' ? primaryStyle : secondaryStyle}`}
    >
      {children}
    </button>
  );
};

export default Button;