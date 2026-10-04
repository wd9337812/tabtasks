import React from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import App from './tasks';
createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><App/></MotionConfig>);
