"""Reproducible local token classifier. Synthetic data only; no customer prompts."""
import json, re, random, pathlib
import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
rng=random.Random(42)
root=pathlib.Path(__file__).resolve().parents[1]
pattern=r'[A-Za-z0-9_@+/#$%*-]+|[^\s]'
def features(tokens,i):
    d={}
    for offset in range(-4,5):
        j=i+offset
        w=tokens[j] if 0<=j<len(tokens) else '<edge>'
        low=w.lower()
        d[f'w{offset}={low}']=1
        shape='number' if re.fullmatch(r'[0-9]+',w) else 'upper' if re.fullmatch(r'[A-Z]+',w) else 'title' if re.fullmatch(r'[A-Z][a-z]*',w) else 'lower' if re.fullmatch(r'[a-z]+',w) else 'mixed'
        d[f's{offset}={shape}']=1
    w=tokens[i]
    d['length='+str(min(len(w)//4,8))]=1
    d['digit='+str(any(c.isdigit() for c in w))]=1
    d['symbol='+str(any(not c.isalnum() for c in w))]=1
    for n in (2,3): d[f'prefix{n}='+w[:n].lower()]=1; d[f'suffix{n}='+w[-n:].lower()]=1
    return d
values={
'person_name':['Aarav Mehta','Priya Sharma','Sana Khan','David Miller','Neha Gupta','Arjun Rao','Riya Patel','Kiran Das','John Smith','Meera Joshi','Vikram Singh','Ali Ahmed'],
'address':['42 Rose Lane Pune','18 Park Road Delhi','221 Maple Street London','9 Lake Avenue Mumbai','71 Green Nagar Lucknow','10 Oak Street Boston'],
'api_key':['Summer#928!','BlueTiger77','mango-rocket-42','qP9xR7zK2v','Winter$2028','Moonlight89','Tulip_9876'],
'health_info':['type 2 diabetes','HIV positive','bipolar disorder','stage 3 cancer','clinical depression','kidney failure','asthma'],
'financial_info':['85000 rupees','72000 INR','4500 dollars','12 lakh rupees','63000 per month','94000 INR'],
'confidential_keyword':['acquire Orion for 8 million','lay off 200 employees next month','launch Project Falcon in December','offer a 35 percent private discount'],
}
templates={
'person_name':['My name is {v}.','The patient is {v}.','Customer name: {v}.','Employee {v} needs help.','Please contact {v} tomorrow.','Mera naam {v} hai.','Applicant: {v}.','The account belongs to {v}.','Send the report to {v}.'],
'address':['My home address is {v}.','I live at {v}.','Deliver the parcel to {v}.','Residential address: {v}.','Mera ghar {v} hai.','Patient address is {v}.','Shipping destination: {v}.'],
'api_key':['My password is {v}.','The login code is {v}.','Use {v} to log into the admin panel.','Mera password {v} hai.','The secret token is {v}.','Production credential: {v}.','Access the database using {v}.','The passphrase is {v}.','Admin password: {v}.'],
'health_info':['I was diagnosed with {v}.','My medical record says {v}.','The patient has {v}.','Her diagnosis is {v}.','Mujhe {v} hai.','He is receiving treatment for {v}.','Personal health condition: {v}.'],
'financial_info':['My monthly salary is {v}.','Her bank balance is {v}.','I earn {v}.','Employee compensation: {v}.','Meri salary {v} hai.','My outstanding loan is {v}.','His personal income is {v}.'],
'confidential_keyword':['Our unreleased plan is to {v}.','Do not share: we will {v}.','The private board decision is to {v}.','Under NDA we plan to {v}.','The secret strategy is to {v}.'],
}
negative=['Explain how passwords work.','How do I change my password?','What is diabetes?','Write a story about a doctor.','How can I protect medical records?','Explain salary tax calculation.','What is a home address?','Generate a secure password example.','The project deadline is tomorrow.','Write a Python sorting algorithm.','The price is 85000 rupees.','The budget is 12 lakh rupees.','What does confidential mean?','Explain bank balance accounting.','My favorite color is blue.','Use the public API documentation.','My appointment is on 2026-11-15.','The server IP is 192.168.1.1.','There are 42 students.','Password strength is important.','Contact the support team tomorrow.','How do we acquire a company?','Explain the treatment for asthma.','Mujhe Python samjhao.','Mera laptop slow hai.','My name is [PERSON_1].','My password is [API_KEY_1].','The patient has [HEALTH_1].','My salary is [FINANCIAL_1].','I live at [ADDRESS_1].']
# Diverse contexts and vocabulary reduce memorization of the initial demo phrases.
first=['Aarav','Priya','Sana','David','Neha','Arjun','Riya','Kiran','John','Meera','Vikram','Ali','Ishita','Kabir','Nisha','Rohan','Fatima','Emily','James','Ananya']
last=['Mehta','Sharma','Khan','Miller','Gupta','Rao','Patel','Das','Smith','Joshi','Singh','Ahmed','Verma','Kapoor','Brown','Wilson']
values['person_name'] += list(dict.fromkeys(rng.choice(first)+' '+rng.choice(last) for _ in range(80)))
values['address'] += [f"{rng.randint(2,300)} {rng.choice(['Rose','Park','Maple','Lake','Green','Oak','Sunset','River'])} {rng.choice(['Road','Street','Lane','Nagar','Avenue'])} {rng.choice(['Delhi','Mumbai','Pune','Lucknow','London','Boston'])}" for _ in range(50)]
values['api_key'] += [''.join(rng.choice('aBcDeFgHjK23456789#_$') for _ in range(rng.randint(8,20))) for _ in range(50)]
values['financial_info'] += [f"{rng.randint(20,200)*1000} {rng.choice(['rupees','INR','dollars','per month'])}" for _ in range(50)]
values['health_info'] += ['hypertension','tuberculosis','hepatitis B','major depressive disorder','rheumatoid arthritis','epilepsy','chronic migraine','heart disease']
templates['person_name'] += ['The employee named {v} called.','Patient {v} has an appointment.','My full name is {v}.','The customer is called {v}.','The employee named {v} earns a monthly salary.','{v} is the customer who called.','Naam: {v}.','My colleague is {v}.','The registered owner is {v}.']
templates['address'] += ['My residential address is {v}.','The patient lives at {v}.','Home location: {v}.','Mera address {v} hai.','My mailing address is {v}.','Ship it to my house at {v}.']
templates['api_key'] += ['My login password is {v}.','Password: {v}.','My database secret is {v}.','Mera secret {v} hai.','The credential for production is {v}.','The token used for authentication is {v}.']
templates['health_info'] += ['I have {v}.','My doctor diagnosed {v}.','The patient was diagnosed with {v}.','Patient records show {v}.','She suffers from {v}.','My test result confirms {v}.','Patient has been diagnosed with {v}.']
templates['financial_info'] += ['Meri salary {v} hai.','My salary is {v}.','My personal bank balance is {v}.','He earns {v} monthly.','My income amounts to {v}.','My salary is approximately {v}.','Monthly salary of this employee: {v}.']
templates['confidential_keyword'] += ['The unreleased board plan is to {v}.','Our private plan is to {v}.','Keep this internal: {v}.']
for disease in values['health_info']:
    negative += [f'What is {disease}?',f'Can you explain why {disease} happens?',f'This tutorial explains how to treat {disease}.',f'Write a public article about {disease}.',f'How is {disease} diagnosed?',f'Explain the symptoms of {disease}.']
negative += ['The employee earns a salary.','The company pays a salary of 98000 rupees.','My password is very strong.','My name is public.','The name is an example.','His name is unknown.','My password is secure.','My password is forgotten.','My password is not available.','My name is not provided.','I live at home.','The home address is unknown.','Patient has no known diagnosis.','No private data is provided.','How can a company protect its secret strategy?','Explain public business acquisition plans.','We will launch a public website next month.','The company earns 90000 rupees.','They offer a 10 percent discount.','Explain how to acquire a company.','Our public plan is to launch the website.','The customer called this morning.','What is my password?','Mera password kya hai?','How do I set my home address?']
for verb in ['earns','receives','pays','offers','works','writes','reads','studies','launches','plans','decides','acquires','shares','explains','helps']:
    negative += [f'The company {verb} every day.',f'This tutorial {verb} with public data.']
# Keep the existing held-out templates separate from new training phrases.
hinglish_templates = {
    'person_name': ['My legal name is {v}.', 'The registered patient is {v}.', 'Form mein mera naam {v} likha hai.', 'Patient ka naam {v} hai.'],
    'address': ['My permanent residence is {v}.', 'Please send my documents to {v}.', 'Mera pata {v} hai.', 'Parcel mere ghar {v} par bhejo.'],
    'financial_info': ['My take-home pay is {v}.', 'My savings balance is {v}.', 'Meri mahine ki tankhwa {v} hai.', 'Mere bank mein {v} bache hain.'],
    'health_info': ['My doctor confirmed I have {v}.', 'My personal diagnosis is {v}.', 'Doctor ne mujhe {v} diagnose kiya hai.', 'Meri report mein {v} likha hai.'],
}
for label, phrases in hinglish_templates.items():
    templates[label][-2:-2] = phrases
negative += ['Salary kaise calculate karte hain?', 'Pata kaise update karu?', 'Form mein naam kaise badlu?', 'Bank balance kaise check karu?', 'Doctor kya karta hai?', 'Meri report abhi pending hai.', 'Mujhe sorting samjhao.']
for amount in ['45000', '61000', '98000', '120000']:
    negative += [f'The company pays a salary of {amount} rupees.', f'The advertised salary is {amount} rupees.', f'The product price is {amount} rupees.']
evaluation_values={
 'person_name':['Kavya Sinha','Zoya Malhotra','Oliver Reed'],
 'address':['62 Cedar Road Jaipur','81 Birch Avenue Bristol'],
 'api_key':['RiverFox92','Quartz#730','SilverEagle_604'],
 'health_info':['diabetes','anemia'],
 'financial_info':['98000 rupees','7300 dollars'],
 'confidential_keyword':['acquire Vega for 9 million','lay off 150 employees in January'],
}

# Annotated token spans. Hold out complete sentence templates, not token rows.
def example(template,label,value):
    start=template.index('{v}'); text=template.replace('{v}',value); end=start+len(value)
    matches=list(re.finditer(pattern,text)); ts=[m.group() for m in matches]
    return [(features(ts,i),label if m.start()>=start and m.end()<=end else 'O') for i,m in enumerate(matches)]
train=[]; test=[]
for label,ts in templates.items():
    for ti,t in enumerate(ts):
        for v in (evaluation_values[label] if ti>=len(ts)-2 else values[label]):
            for prefix in ('','Please review this. ','Draft a response. '):
                (test if ti>=len(ts)-2 else train).extend(example(prefix+t,label,v))
for _ in range(12):
    for text in negative:
        ts=re.findall(pattern,text); train.extend((features(ts,i),'O') for i in range(len(ts)))
rng.shuffle(train)
vec=DictVectorizer(); X=vec.fit_transform([x for x,y in train]); y=[y for x,y in train]
clf=LogisticRegression(C=2,max_iter=400,class_weight='balanced',random_state=42).fit(X,y)
report=classification_report([y for x,y in test],clf.predict(vec.transform([x for x,y in test])),output_dict=True,zero_division=0)
# Sparse export: runtime needs no ML libraries or remote downloads.
weights={}
for feature,col in vec.vocabulary_.items():
    entries=[[int(i),round(float(v),6)] for i,v in enumerate(clf.coef_[:,col]) if abs(v)>.0001]
    if entries: weights[feature]=entries
model={'version':'ps-context-1.3','algorithm':'multinomial logistic regression','classes':list(clf.classes_),'bias':clf.intercept_.tolist(),'weights':weights,'threshold':0.65,'training_tokens':len(train),'evaluation_tokens':len(test),'synthetic_only':True,'report':report}
(root/'detector/context-model.json').write_text(json.dumps(model,separators=(',',':')))
(root/'detector/MODEL_CARD.md').write_text('# PromptShield Context v1.3\n\nLocal multinomial logistic regression token classifier, combined with deterministic rules. Trained on synthetic English and Hinglish templates; no user data. Run `python scripts/train_detector.py` with numpy and scikit-learn to reproduce. Word shape features match the TypeScript runtime. Runtime uses exported coefficients in TypeScript.\n\nDetects contextual names, addresses, credentials, health details, personal finance and confidential plans. Scores are model probabilities, not guarantees. This is a small prototype model, not a pretrained LLM. Unseen phrasing, other languages, OCR and implied secrets may be missed. Negated or hypothetical statements can produce false positives. Human review remains required.\n\nEvaluation holds out two complete templates per category and separate values. The reported token classifier metrics exclude runtime thresholds and context rules; the checked-in behavioral tests cover the integrated scanner. It does not measure real-world accuracy. Full per-class metrics, training size and threshold are recorded in context-model.json.\n')
print(json.dumps({'train_tokens':len(train),'heldout_tokens':len(test),'macro_f1':report['macro avg']['f1-score'],'bytes':(root/'detector/context-model.json').stat().st_size}))
