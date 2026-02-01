import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Assessment } from '../types';
import AssessmentTaker from './AssessmentTaker';

interface Props {
    assessment: Assessment;
    onClose: () => void;
}

const AssessmentPreviewModal: React.FC<Props> = ({ assessment, onClose }) => {
    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="fixed top-4 right-4 z-[110]">
                <button
                    onClick={onClose}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="w-full h-full max-w-7xl relative">
                <AssessmentTaker
                    assessment={assessment}
                    invitationId="preview" // Dummy ID
                    mode="preview"
                    onComplete={() => onClose()}
                />

                {/* Preview Banner */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 px-4 py-1 rounded-b-lg font-bold text-sm shadow-lg pointer-events-none z-[120]">
                    PREVIEW MODE
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AssessmentPreviewModal;
