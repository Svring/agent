import React from 'react';
import SshDisplayBar, { type SshDisplayBarProps } from './SshDisplayBar';
import BrowserDisplayBar, { type BrowserDisplayBarProps } from './BrowserDisplayBar';
import GalateaDisplayBar, { type GalateaDisplayBarProps } from './GalateaDisplayBar';

interface FooterControlBarsProps {
  sshProps: SshDisplayBarProps;
  browserProps: BrowserDisplayBarProps;
  galateaProps: GalateaDisplayBarProps;
}

export const FooterControlBars: React.FC<FooterControlBarsProps> = ({
  sshProps,
  browserProps,
  galateaProps,
}) => {
  return (
    <div className="flex flex-col w-full">
      <SshDisplayBar {...sshProps} />
      <BrowserDisplayBar {...browserProps} />
      <GalateaDisplayBar {...galateaProps} />
    </div>
  );
}; 