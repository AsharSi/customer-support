import AgentDashboard from "./AgentDashboard"
import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Agent() {

    const [user, setUser] = useState(null);

    const handleLogin = async (response) => {
        try {
            const res = await fetch('http://localhost:5000/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: response.credential }),
            });
            const data = await res.json();

            if (data.success) {
                setUser(data.user);
                toast.success('Login Success');
            } else {
                toast.error('Login Failed');
                console.log('Login Failed');
                setUser(null);
                
            }
        } catch (error) {
            setUser(null);
            console.log(error);
        }
    }

    return (
        <>
            {
                user ?
                    <AgentDashboard email={user.email} />
                    :
                    <GoogleLogin
                        onSuccess={credentialResponse => {
                            handleLogin(credentialResponse);
                        }}
                        onError={() => {
                            console.log('Login Failed');
                        }}
                    />
            }

            {/* <AgentDashboard email="ashutoshasharsimains@gmail.com" /> */}

        </>
    )
}