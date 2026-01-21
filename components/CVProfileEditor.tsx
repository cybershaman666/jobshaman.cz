import React, { useState, useRef, useEffect } from 'react';
import { Save, Plus, Trash2, Upload, Briefcase, GraduationCap, Award, Link, ExternalLink, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserProfile, uploadCVFile } from '../services/supabaseService';

interface CVProfileEditorProps {
  profile: UserProfile;
  onSave: (profile: Partial<UserProfile>) => void;
  onClose: () => void;
  theme?: 'light' | 'dark';
}



const CVProfileEditor: React.FC<CVProfileEditorProps> = ({
  profile,
  onSave,
  onClose,
  theme = 'light'
}) => {
  const [activeTab, setActiveTab] = useState<'personal' | 'experience' | 'education' | 'skills'>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isDark = theme === 'dark';
  const cardClass = isDark 
    ? 'bg-slate-800 border-slate-700 text-white' 
    : 'bg-white border-slate-200 text-slate-900';
  const inputClass = isDark
    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500';
  const buttonClass = isDark
    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  // Form state
  const [formData, setFormData] = useState({
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    jobTitle: profile.jobTitle || '',
    address: profile.address || '',
    workHistory: profile.workHistory || [],
    education: profile.education || [],
    skills: profile.skills || [],
    cvText: profile.cvText || '',
    linkedIn: (profile as any).linkedIn || '',
    portfolio: (profile as any).portfolio || '',
    github: (profile as any).github || '',
    certificates: (profile as any).certificates || []
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCvFile(file);
    setIsSaving(true);

    try {
      const cvUrl = await uploadCVFile(profile.id || '', file);
      if (cvUrl) {
        // Update CV text using parsing (fallback to manual if parsing fails)
        onSave({ cvUrl, cvText: `[Uploaded: ${file.name}]` });
      }
    } catch (error) {
      console.error('CV upload failed:', error);
      alert('Nepodařilo se nahrát CV. Zkuste to znovu.');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddWorkExperience = () => {
    const newExperience: any = {
      id: Date.now().toString(),
      company: '',
      role: '',
      duration: '',
      description: ''
    };
    setFormData(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, newExperience]
    }));
  };

  const handleUpdateWorkExperience = (id: string, field: keyof WorkExperience, value: string) => {
    setFormData(prev => ({
      ...prev,
      workHistory: prev.workHistory.map(exp => 
        exp.id === id ? { ...exp, [field]: value } : exp
      )
    }));
  };

  const handleRemoveWorkExperience = (id: string) => {
    setFormData(prev => ({
      ...prev,
      workHistory: prev.workHistory.filter(exp => exp.id !== id)
    }));
  };

  const handleAddEducation = () => {
    const newEducation: any = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      field: '',
      year: ''
    };
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, newEducation]
    }));
  };

  const handleUpdateEducation = (id: string, field: keyof Education, value: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map(edu => 
        edu.id === id ? { ...edu, [field]: value } : edu
      )
    }));
  };

  const handleRemoveEducation = (id: string) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter(edu => edu.id !== id)
    }));
  };

  const handleAddSkill = () => {
    const newSkill = prompt('Přidejte novou dovednost:');
    if (newSkill && newSkill.trim()) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const handleAddCertificate = () => {
    const newCertificate: any = {
      id: Date.now().toString(),
      name: '',
      issuer: '',
      date: '',
      url: ''
    };
    setFormData(prev => ({
      ...prev,
      certificates: [...prev.certificates, newCertificate]
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Nepodařilo se uložit profil. Zkuste to znovu.');
    } finally {
      setIsSaving(false);
    }
  };

  const skillsArray = Array.isArray(formData.skills) ? formData.skills : formData.skills.split(',').map(s => s.trim()).filter(s => s);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl ${cardClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Editor životopisu
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {['personal', 'experience', 'education', 'skills'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              {tab === 'personal' && 'Osobní údaje'}
              {tab === 'experience' && 'Zkušenosti'}
              {tab === 'education' && 'Vzdělání'}
              {tab === 'skills' && 'Dovednosti'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Personal Information Tab */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              {/* CV Upload */}
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Nahrání CV
                </h3>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className={`w-full px-4 py-3 rounded-lg border-2 border-dashed transition-colors ${
                    cvFile ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 hover:border-indigo-400'
                  } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {cvFile ? `Vybráno: ${cvFile.name}` : 'Vyberte soubor s CV (PDF, DOC, DOCX)'}
                </button>
              </div>

              {/* Manual CV Text */}
              <div className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <h3 className="text-lg font-semibold mb-4">Text životopisu (volitelné)</h3>
                <textarea
                  value={formData.cvText}
                  onChange={(e) => setFormData(prev => ({ ...prev, cvText: e.target.value }))}
                  placeholder="Vložte text vašeho životopisu sem nebo nahrajte CV výše..."
                  className={`w-full h-32 p-3 rounded-lg ${inputClass} resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Jméno</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">E-mail</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Pracovní pozice</label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                    className={`w-full px-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Adresa</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className={`w-full px-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  placeholder="Ulice, město, PSČ"
                />
              </div>

              {/* Professional Links */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">LinkedIn</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="url"
                      value={formData.linkedIn}
                      onChange={(e) => setFormData(prev => ({ ...prev, linkedIn: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      placeholder="linkedin.com/in/jmeno-prijmeni"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Portfolio</label>
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="url"
                      value={formData.portfolio}
                      onChange={(e) => setFormData(prev => ({ ...prev, portfolio: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      placeholder="vasewebova.cz"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">GitHub</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="url"
                      value={formData.github}
                      onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
                      className={`w-full pl-10 pr-4 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      placeholder="github.com/jmeno"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Experience Tab */}
          {activeTab === 'experience' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                  Pracovní zkušenosti
                </h3>
                <button
                  onClick={handleAddWorkExperience}
                  className={`px-3 py-2 rounded-lg ${buttonClass} text-sm flex items-center gap-1`}
                >
                  <Plus className="w-4 h-4" />
                  Přidat zkušenost
                </button>
              </div>

              {formData.workHistory.map((experience) => (
                <div key={experience.id} className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Pracovní zkušenost #{experience.id.slice(-4)}</h4>
                    <button
                      onClick={() => handleRemoveWorkExperience(experience.id)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Společnost</label>
                      <input
                        type="text"
                        value={experience.company}
                        onChange={(e) => handleUpdateWorkExperience(experience.id, 'company', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="Název společnosti"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Pozice</label>
                      <input
                        type="text"
                        value={experience.role}
                        onChange={(e) => handleUpdateWorkExperience(experience.id, 'role', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="Název pozice"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Doba působení</label>
                    <input
                      type="text"
                      value={experience.duration}
                      onChange={(e) => handleUpdateWorkExperience(experience.id, 'duration', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="např. 2020 - 2022 (2 roky)"
                      />
                    </div>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Popis práce a úspěchy</label>
                    <textarea
                      value={experience.description}
                      onChange={(e) => handleUpdateWorkExperience(experience.id, 'description', e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg ${inputClass} resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      rows={3}
                      placeholder="Popište své hlavní odpovědnosti a úspěchy..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Education Tab */}
          {activeTab === 'education' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Vzdělání
                </h3>
                <button
                  onClick={handleAddEducation}
                  className={`px-3 py-2 rounded-lg ${buttonClass} text-sm flex items-center gap-1`}
                >
                  <Plus className="w-4 h-4" />
                  Přidat vzdělání
                </button>
              </div>

              {formData.education.map((edu) => (
                <div key={edu.id} className={`p-4 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Vzdělání #{edu.id.slice(-4)}</h4>
                    <button
                      onClick={() => handleRemoveEducation(edu.id)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Škola / Univerzita</label>
                      <input
                        type="text"
                        value={edu.school}
                        onChange={(e) => handleUpdateEducation(edu.id, 'school', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="Název instituce"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Stupeň / Titul</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="např. Ing., Bc., Mgr."
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Obor</label>
                      <input
                        type="text"
                        value={edu.field}
                        onChange={(e) => handleUpdateEducation(edu.id, 'field', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="např. Informační technologie"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Rok ukončení</label>
                      <input
                        type="text"
                        value={edu.year}
                        onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg ${inputClass} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        placeholder="např. 2020"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skills Tab */}
          {activeTab === 'skills' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Dovednosti
                </h3>
                <button
                  onClick={handleAddSkill}
                  className={`px-3 py-2 rounded-lg ${buttonClass} text-sm flex items-center gap-1`}
                >
                  <Plus className="w-4 h-4" />
                  Přidat dovednost
                </button>
              </div>

              <div className="space-y-2">
                {skillsArray.map((skill, index) => (
                  <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <span className="font-medium">{skill}</span>
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                      title="Smazat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
            }`}
          >
            Zrušit
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2 rounded-lg font-medium ${buttonClass} flex items-center gap-2 ${
              isSaving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Ukládám...' : 'Uložit profil'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CVProfileEditor;