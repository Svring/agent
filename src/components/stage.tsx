import React from 'react';
import MiniBrowser from './mini-browser';

interface StageProps {
  className?: string;
}

const Stage: React.FC<StageProps> = ({
  className,
}) => {
  return (
    <div className={`flex flex-col justify-center items-center bg-background rounded-lg ${className || ''}`}>
      <MiniBrowser />
    </div>
  );
};

export default Stage;
